import { NextRequest, NextResponse } from 'next/server';
// @ts-expect-error - @types/node@20 无 node:sqlite 类型声明（Node 22.5+ 内置模块），升级后删除本行
import { DatabaseSync } from 'node:sqlite';
import { existsSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

// ============================================================
// Types
// ============================================================
interface ZoteroCollection {
  key: string;
  name: string;
  paperCount: number;
}

interface ZoteroPaper {
  key: string;
  title: string;
  abstract: string;
  date: string;
  creators: string;
  publicationTitle: string;
  url: string;
  doi: string;
  tags: string[];
  hasPdf: boolean;
  pdfText: string;
  notes: string;
}

// ============================================================
// Zotero DB path
// ============================================================
const ZOTERO_DB = join(/* turbopackIgnore: true */ process.env.HOME || '~', 'Zotero/zotero.sqlite');
const ZOTERO_STORAGE = join(/* turbopackIgnore: true */ process.env.HOME || '~', 'Zotero/storage');

function openDb(): DatabaseSync {
  // Copy to temp to avoid lock issue with running Zotero
  const tmpPath = join(tmpdir(), 'zotero-' + randomUUID() + '.sqlite');
  cpSync(ZOTERO_DB, tmpPath);
  return new DatabaseSync(tmpPath);
}

// ============================================================
// Extract text from PDF
// ============================================================
// PDF 全文抽取原本通过 spawn 子进程运行 scripts/extract-pdf.cjs，但该动态
// 脚本路径会让 Turbopack 生产构建失败（server relative imports），且依赖本地
// ~/Zotero 在云端无法运行，故暂时停用。如需恢复，可改为在 route 内直接
// import pdfjs-dist 实现进程内抽取。
async function extractPdfText(_pdfPath: string): Promise<string> {
  return '';
}

// ============================================================
// API Handler
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body as { action: string };

    if (!existsSync(ZOTERO_DB)) {
      return NextResponse.json({ error: '未找到 Zotero 数据库。请确认 Zotero 已安装。' }, { status: 404 });
    }

    const db = openDb();

    try {
      if (action === 'collections') {
        const collections = db.prepare(`
          SELECT c.key, c.collectionName as name, COUNT(ci.itemID) as paperCount
          FROM collections c
          LEFT JOIN collectionItems ci ON ci.collectionID = c.collectionID
          GROUP BY c.collectionID, c.key, c.collectionName
        `).all() as ZoteroCollection[];

        db.close();
        return NextResponse.json({ collections });
      }

      if (action === 'papers') {
        const { collectionKey } = body as { collectionKey: string };
        if (!collectionKey) {
          db.close();
          return NextResponse.json({ error: '缺少 collectionKey' }, { status: 400 });
        }

        // Find collection ID from key
        const col = db.prepare(
          'SELECT collectionID FROM collections WHERE key = ?'
        ).get(collectionKey) as { collectionID: number } | undefined;

        if (!col) {
          db.close();
          return NextResponse.json({ papers: [] });
        }

        // Get items in this collection
        const items = db.prepare(`
          SELECT i.itemID, i.key
          FROM collectionItems ci
          JOIN items i ON i.itemID = ci.itemID
          WHERE ci.collectionID = ?
        `).all(col.collectionID) as { itemID: number; key: string }[];

        const papers: ZoteroPaper[] = [];

        for (const item of items) {
          // Get metadata
          const metaRows = db.prepare(`
            SELECT f.fieldName, v.value
            FROM itemData d
            JOIN fields f ON f.fieldID = d.fieldID
            JOIN itemDataValues v ON v.valueID = d.valueID
            WHERE d.itemID = ?
          `).all(item.itemID) as { fieldName: string; value: string }[];

          const meta: Record<string, string> = {};
          for (const r of metaRows) meta[r.fieldName] = r.value || '';

          // Get creators
          const creators = db.prepare(`
            SELECT c.firstName, c.lastName
            FROM itemCreators ic
            JOIN creators c ON c.creatorID = ic.creatorID
            WHERE ic.itemID = ?
            ORDER BY ic.orderIndex
          `).all(item.itemID) as { firstName: string; lastName: string }[];

          const creatorStr = creators
            .map((c) => (c.lastName ? `${c.lastName}, ${c.firstName || ''}` : c.firstName))
            .filter(Boolean)
            .join('; ');

          // Get tags
          const tags = db.prepare(`
            SELECT t.name FROM itemTags it
            JOIN tags t ON t.tagID = it.tagID
            WHERE it.itemID = ?
          `).all(item.itemID) as { name: string }[];

          // Get notes
          const notes = db.prepare(`
            SELECT n.note FROM itemNotes n
            WHERE n.parentItemID = ?
          `).all(item.itemID) as { note: string }[];

          // Strip HTML from notes
          const noteText = notes.map((n) => n.note.replace(/<[^>]*>/g, '').trim()).join('\n---\n');

          // Get PDF attachment
          const pdfAtt = db.prepare(`
            SELECT i2.key as attKey, a.path
            FROM itemAttachments a
            JOIN items i2 ON i2.itemID = a.itemID
            WHERE a.parentItemID = ? AND a.contentType = 'application/pdf'
            LIMIT 1
          `).get(item.itemID) as { attKey: string; path: string } | undefined;

          let pdfText = '';
          if (pdfAtt) {
            const filename = pdfAtt.path.replace('storage:', '');
            const pdfPath = join(ZOTERO_STORAGE, pdfAtt.attKey, filename);
            if (existsSync(pdfPath)) {
              pdfText = await extractPdfText(pdfPath);
            }
          }

          papers.push({
            key: item.key,
            title: meta.title || meta['citationTitle'] || '',
            abstract: meta.abstractNote || '',
            date: meta.date || '',
            creators: creatorStr,
            publicationTitle: meta.publicationTitle || meta['journalAbbreviation'] || '',
            url: meta.url || '',
            doi: meta.DOI || '',
            tags: tags.map((t) => t.name),
            hasPdf: !!pdfAtt,
            pdfText,
            notes: noteText,
          });
        }

        db.close();

        // Build RAG context
        const ragText = papers
          .map(
            (p) =>
              `## ${p.title}\n` +
              `作者: ${p.creators || '未知'} | ${p.date?.slice(0, 4) || ''} | ${p.publicationTitle}\n` +
              `标签: ${p.tags.join(', ')}\n` +
              (p.abstract ? `摘要: ${p.abstract.slice(0, 500)}\n` : '') +
              (p.notes ? `笔记: ${p.notes.slice(0, 1000)}\n` : '') +
              (p.pdfText ? `全文内容:\n${p.pdfText.slice(0, 5000)}\n` : ''),
          )
          .join('\n---\n');

        console.log(
          `[ZoteroLocal] 📚 已加载 ${papers.length} 篇论文，其中 ${papers.filter((p) => p.hasPdf).length} 篇含 PDF 全文`,
        );

        return NextResponse.json({ papers, ragContext: ragText });
      }

      db.close();
      return NextResponse.json({ error: '无效的 action' }, { status: 400 });
    } catch (err) {
      db.close();
      throw err;
    }
  } catch (err) {
    console.error('[ZoteroLocal] Error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

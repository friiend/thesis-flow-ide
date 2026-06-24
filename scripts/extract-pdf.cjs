// Standalone CJS script for PDF text extraction
// Called from Next.js API route to avoid ESM/CJS issues with pdfjs-dist
const { readFileSync } = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

async function extractPdf(pdfPath) {
  try {
    const data = new Uint8Array(readFileSync(pdfPath));
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const texts = [];
    const maxPages = Math.min(doc.numPages, 80);
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .filter((item) => item.str)
        .map((item) => item.str)
        .join(' ');
      texts.push(pageText);
    }
    const fullText = texts.join('\n').slice(0, 50000);
    console.log(JSON.stringify({ ok: true, text: fullText, pages: doc.numPages }));
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: err.message }));
  }
}

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.log(JSON.stringify({ ok: false, error: 'No PDF path provided' }));
  process.exit(1);
}
extractPdf(pdfPath);

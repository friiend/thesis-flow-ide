import type { Message } from './db';

interface Variable {
  key: string;
  value: string;
}

/**
 * Extract Chinese + English keywords from text by splitting on common delimiters
 * and filtering out short / stop words.
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
    '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
    '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '些',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'or', 'and', 'not', 'this',
    'that', 'it', 'its',
  ]);

  const tokens = text
    .split(/[\s，。！？、；：""''「」『』【】（）\(\)\,\.\!\?\;\:\"\'\[\]\{\}\<\>\-\—\=\+\\\/\|@#\$%^&\*]+/)
    .filter((t) => {
      const trimmed = t.trim();
      if (trimmed.length < 2) return false;
      if (stopWords.has(trimmed.toLowerCase())) return false;
      if (/^\d+$/.test(trimmed)) return false;
      return true;
    });

  return [...new Set(tokens)];
}

function scoreMessage(msg: Message, queryKeywords: string[]): number {
  if (msg.role === 'system') return 0;
  if (!queryKeywords.length) return 0.5;

  const content = msg.content.toLowerCase();
  let score = 0;
  for (const kw of queryKeywords) {
    const lowerKw = kw.toLowerCase();
    const occurrences = content.split(lowerKw).length - 1;
    score += occurrences * 2;
    if (lowerKw.length >= 3 && content.includes(lowerKw)) {
      score += 1;
    }
  }
  return score;
}

function estimateTokens(text: string): number {
  let chineseChars = 0;
  let otherChars = 0;
  for (const ch of text) {
    if (/[一-鿿㐀-䶿]/.test(ch)) {
      chineseChars++;
    } else if (/\s/.test(ch)) {
      otherChars++;
    } else {
      otherChars++;
    }
  }
  return Math.ceil(chineseChars * 1.3 + otherChars * 0.75);
}

interface TruncationResult {
  selectedMessages: Pick<Message, 'role' | 'content'>[];
  estimatedTokens: number;
}

export function selectRelevantContext(
  messages: Message[],
  tokenBudget: number = 2000,
): TruncationResult {
  if (messages.length === 0) return { selectedMessages: [], estimatedTokens: 0 };

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const queryKeywords = lastUserMsg ? extractKeywords(lastUserMsg.content) : [];

  const RECENT_COUNT = 8;
  const recentMessages = messages.slice(-RECENT_COUNT);
  const olderMessages = messages.slice(0, -RECENT_COUNT);

  const scored = olderMessages
    .map((msg) => ({ msg, score: scoreMessage(msg, queryKeywords) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const result: Message[] = [...recentMessages];
  let currentTokens = result.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  for (const { msg } of scored) {
    const msgTokens = estimateTokens(msg.content);
    if (currentTokens + msgTokens > tokenBudget) break;
    result.push(msg);
    currentTokens += msgTokens;
  }

  result.sort((a, b) => {
    const ta = a.timestamp?.getTime?.() ?? 0;
    const tb = b.timestamp?.getTime?.() ?? 0;
    return ta - tb;
  });

  return {
    selectedMessages: result.map((m) => ({ role: m.role, content: m.content })),
    estimatedTokens: currentTokens,
  };
}

// ============================================================
// 双轨制 System Prompt 构建器
// ============================================================

/**
 * Build the full system prompt with dual-track injection:
 * - thesisContext: 本文工程进度 → 最高优先级强制注入，约束写作方向
 * - referenceContext: 外部文献 → 动态 RAG 检索后注入作为论据支撑
 * - variables: 全局变量
 */
export function buildSystemPrompt(variables: Variable[], thesisContext?: string, referenceContext?: string): string {
  let prompt = `# Role
You are a top-tier academic thesis advisor specializing in sports science (体育科学) and empirical research methodology. You guide graduate students through thesis writing, experimental design, statistical analysis, and academic polishing. Your tone is professional, rigorous, and constructive.

# Core Guidelines
- Respond in Chinese (Simplified) unless the user writes in English.
- Provide concrete, actionable academic advice — never vague generalities.
- When suggesting statistical methods, specify the test name (e.g., independent t-test, ANOVA, regression) and when it is appropriate.
- When discussing literature, reference theoretical frameworks precisely.
- Keep responses concise but dense with academic value. Avoid filler words.
- Use proper academic formatting: clearly separate sections, define terms, cite methodological standards.

`;

  // ============================================================
  // 第一轨（最高优先级）：本文工程进度舱 → 强制注入
  // ============================================================
  if (thesisContext && thesisContext.trim()) {
    prompt += `# 🔴 HIGHEST PRIORITY — Your Student's Thesis Progress & Context
The following is the student's OWN thesis manuscript, outline, and completed chapters.
You MUST read and internalize this context:

## CRITICAL RULES for using this context:
1. **Writing Direction**: Strictly adhere to the thesis topic, research questions, and methodology described below. Do NOT suggest alternative topics or radically different approaches.
2. **Progress Awareness**: The student has already written the content below. Do NOT generate duplicate content or ask the student to rewrite what already exists.
3. **Gap-Filling Mode**: Focus on what's MISSING — help the student complete unwritten sections, strengthen weak arguments, and expand thin sections.
4. **Consistency**: Match the writing style, terminology, and citation format already used in the manuscript.

## 📁 Student's Current Thesis Content:
${thesisContext}

--- END OF THESIS CONTEXT ---

`;
  }

  // ============================================================
  // 第二轨：外部文献引用仓 → 动态 RAG 论据支撑
  // ============================================================
  if (referenceContext && referenceContext.trim()) {
    prompt += `# 📖 Reference Literature (Supporting Evidence)
The following are external reference materials the student has collected. Use these as supporting evidence, counterarguments, or methodological references when relevant to the student's query:

${referenceContext}

--- END OF REFERENCE CONTEXT ---

`;
  }

  // ============================================================
  // 全局变量
  // ============================================================
  if (variables.length > 0) {
    prompt += `# Researcher-Defined Core Variables\n`;
    prompt += `The following are the user's self-defined research parameters. Prioritize these when giving advice:\n`;
    for (const v of variables) {
      prompt += `- **${v.key}**: ${v.value}\n`;
    }
    prompt += `\n`;
  }

  prompt += `# Output Format
- Use clear headings (##) for different sections of your response.
- When providing writing templates or examples, use blockquotes.
- When listing methodologies, use numbered lists with brief pros/cons.
- End each response with 1-2 concrete "Next Steps" the student should take.`;

  return prompt;
}

// ============================================================
// 简单关键词 RAG：从参考文本中检索与 query 最相关的段落
// ============================================================
export function retrieveRelevantPassages(query: string, referenceText: string, maxChars: number = 3000): string {
  if (!referenceText || !query) return referenceText.slice(0, maxChars);

  const keywords = extractKeywords(query);
  if (keywords.length === 0) return referenceText.slice(0, maxChars);

  // Split reference text into paragraphs
  const paragraphs = referenceText.split(/\n\n+/).filter((p) => p.trim().length > 20);

  // Score each paragraph against query keywords
  const scored = paragraphs.map((p) => {
    const lower = p.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      const lowerKw = kw.toLowerCase();
      const occurrences = lower.split(lowerKw).length - 1;
      score += occurrences * 3;
      if (lowerKw.length >= 3 && lower.includes(lowerKw)) score += 1;
    }
    return { text: p, score };
  });

  // Select top-scoring paragraphs within budget
  scored.sort((a, b) => b.score - a.score);

  let result = '';
  let used = 0;
  for (const { text, score } of scored) {
    if (score === 0) break;
    if (used + text.length > maxChars) break;
    result += text + '\n\n';
    used += text.length + 2;
  }

  return result || referenceText.slice(0, maxChars);
}

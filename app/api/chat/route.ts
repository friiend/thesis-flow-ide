import { NextRequest, NextResponse } from 'next/server';
import { selectRelevantContext, buildSystemPrompt, retrieveRelevantPassages } from '@/lib/contextTruncation';
import type { Message } from '@/lib/db';

// ============================================================
// 多供应商配置
// ============================================================
interface ProviderConfig {
  url: string;
  apiKey: string | undefined;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  deepseek: {
    url: 'https://api.deepseek.com/chat/completions',
    apiKey: process.env.DEEPSEEK_API_KEY,
  },
  zhipu: {
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    apiKey: process.env.GLM_API_KEY,
  },
};

// ============================================================
// 模型 → 供应商映射
// ============================================================
interface ModelConfig {
  provider: string;
  model: string;
  budget: number;
}

const MODEL_CONFIG: Record<string, ModelConfig> = {
  'deepseek-v3':   { provider: 'deepseek', model: 'deepseek-chat',     budget: 3000 },
  'deepseek-r1':   { provider: 'deepseek', model: 'deepseek-reasoner', budget: 2000 },
  'glm-4-plus':    { provider: 'zhipu',    model: 'glm-4-plus',        budget: 3000 },
  'glm-4-flash':   { provider: 'zhipu',    model: 'glm-4-flash',       budget: 6000 },
};

const DEFAULT_MODEL = 'deepseek-v3';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages = [],
      variables = [],
      modelPreference = DEFAULT_MODEL,
      ragContext = '',
      thesisContext = '',
    } = body as {
      messages: Message[];
      variables: { key: string; value: string }[];
      modelPreference?: string;
      ragContext?: string;
      thesisContext?: string;
    };

    // --- Resolve model config ---
    const mc = MODEL_CONFIG[modelPreference] ?? MODEL_CONFIG[DEFAULT_MODEL];
    const provider = PROVIDERS[mc.provider];

    if (!provider || !provider.apiKey) {
      const envVar = mc.provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'GLM_API_KEY';
      return NextResponse.json(
        { error: `${mc.provider} API Key 未配置。请在 .env.local 中添加:\n${envVar}=your-key` },
        { status: 401 },
      );
    }

    // --- RAG ---
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const userQuery = lastUserMsg?.content ?? '';

    let referenceContext = '';
    if (ragContext && userQuery) {
      referenceContext = retrieveRelevantPassages(userQuery, ragContext, 2500);
    } else if (ragContext) {
      referenceContext = ragContext.slice(0, 2500);
    }

    const systemPrompt = buildSystemPrompt(variables || [], thesisContext, referenceContext);
    const { selectedMessages } = selectRelevantContext(messages, mc.budget);

    const apiMessages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];
    if (ragContext && !referenceContext) {
      apiMessages.push({ role: 'system', content: ragContext.slice(0, 2500) });
    }
    for (const m of selectedMessages) {
      apiMessages.push({ role: m.role, content: m.content });
    }

    console.log(
      `[ThesisFlow] ${mc.provider}/${mc.model} | ${apiMessages.length} msgs | budget: ${mc.budget} | thesisCtx: ${thesisContext.length} chars`,
    );

    // --- Call provider ---
    const response = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: mc.model,
        messages: apiMessages,
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ThesisFlow] ${mc.provider} error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `${mc.provider} API 返回错误 (${response.status})，请稍后重试。` },
        { status: response.status },
      );
    }

    const data = await response.json();
    const aiContent =
      data?.choices?.[0]?.message?.content ?? '(模型返回为空，请重试)';

    return NextResponse.json({ content: aiContent, model: mc.model });
  } catch (err) {
    console.error('[ThesisFlow] API route error:', err);
    return NextResponse.json(
      { error: '服务器内部错误，请查看终端日志。' },
      { status: 500 },
    );
  }
}

import { create } from 'zustand';
import { db, type Session, type Message } from '../lib/db';

export const MODEL_OPTIONS = [
  {
    value: 'deepseek-v3',
    label: 'DeepSeek V3 · 通用对话',
    icon: 'zap',
    desc: '综合能力强，适合日常论文写作、文献分析与润色',
  },
  {
    value: 'deepseek-r1',
    label: 'DeepSeek R1 · 深度推理',
    icon: 'brain',
    desc: '推理能力更强，适合复杂学术论证、方法论设计',
  },
  {
    value: 'glm-4-plus',
    label: 'GLM-4 Plus · 智谱旗舰',
    icon: 'sparkles',
    desc: '智谱最强模型，中文学术能力强，均衡高效',
  },
  {
    value: 'glm-4-flash',
    label: 'GLM-4 Flash · 极速响应',
    icon: 'flame',
    desc: '响应极快，适合快速润色、提纲生成等轻量任务',
  },
] as const;

interface ChatState {
  currentSessionId: number | null;
  sessions: Session[];
  messages: Message[];
  currentModel: string;

  initLoad: (projectKey: string) => Promise<void>;
  changeSession: (sessionId: number) => Promise<void>;
  addMessage: (role: 'user' | 'assistant', content: string) => Promise<void>;
  setModel: (model: string) => void;
  switchProject: (projectKey: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentSessionId: null,
  sessions: [],
  messages: [],
  currentModel: 'deepseek-v3',

  initLoad: async (projectKey: string) => {
    const allSessions = await db.sessions
      .where('projectKey')
      .equals(projectKey)
      .reverse()
      .sortBy('updatedAt');

    if (allSessions.length > 0) {
      const latestSessionId = allSessions[0].id!;
      const associatedMessages = await db.messages
        .where('sessionId')
        .equals(latestSessionId)
        .toArray();

      set({
        sessions: allSessions,
        currentSessionId: latestSessionId,
        messages: associatedMessages,
      });
    } else {
      const newSession: Session = {
        projectKey,
        title: '新论文开题对话',
        paperMode: projectKey === 'graduate' ? 'graduate' : 'conference',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const newId = await db.sessions.add(newSession);
      set({
        sessions: [{ ...newSession, id: newId }],
        currentSessionId: newId,
        messages: [],
      });
    }
  },

  changeSession: async (sessionId: number) => {
    const associatedMessages = await db.messages
      .where('sessionId')
      .equals(sessionId)
      .toArray();
    set({
      currentSessionId: sessionId,
      messages: associatedMessages,
    });
  },

  addMessage: async (role: 'user' | 'assistant', content: string) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    const newMessage: Message = {
      sessionId: currentSessionId,
      role,
      content,
      timestamp: new Date(),
    };

    await db.messages.add(newMessage);
    await db.sessions.update(currentSessionId, { updatedAt: new Date() });

    const updatedMessages = await db.messages
      .where('sessionId')
      .equals(currentSessionId)
      .toArray();
    const allSessions = await db.sessions
      .orderBy('updatedAt')
      .reverse()
      .toArray();

    set({
      messages: updatedMessages,
      sessions: allSessions,
    });
  },

  setModel: (model: string) => {
    set({ currentModel: model });
  },

  switchProject: async (projectKey: string) => {
    const allSessions = await db.sessions
      .where('projectKey')
      .equals(projectKey)
      .reverse()
      .sortBy('updatedAt');

    if (allSessions.length > 0) {
      const latestSessionId = allSessions[0].id!;
      const associatedMessages = await db.messages
        .where('sessionId')
        .equals(latestSessionId)
        .toArray();

      set({
        sessions: allSessions,
        currentSessionId: latestSessionId,
        messages: associatedMessages,
      });
    } else {
      const newSession: Session = {
        projectKey,
        title: '新论文开题对话',
        paperMode: projectKey === 'graduate' ? 'graduate' : 'conference',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const newId = await db.sessions.add(newSession);
      set({
        sessions: [{ ...newSession, id: newId }],
        currentSessionId: newId,
        messages: [],
      });
    }
  },
}));

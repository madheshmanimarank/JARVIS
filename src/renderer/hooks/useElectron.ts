import { useState, useEffect, useCallback, useRef } from 'react';
import type { AIRequest, AIResponse, AIStreamChunk, ModelInfo, ProviderStatus, Conversation, Message, MemoryEntry, Tool, ToolResult, SystemMetrics, AppSettings } from '@shared/types';
import { VoiceState } from '@shared/types';

export function useElectron() {
  return window.electron;
}

export function useAIStatus() {
  const [status, setStatus] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await window.electron.ai.getStatus();
      setStatus(Array.isArray(result) ? result : [result]);
    } catch (error) {
      console.error('Failed to fetch AI status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { status, loading, refetch: fetchStatus };
}

export function useModels(provider?: string) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModels = useCallback(async () => {
    try {
      const result = await window.electron.ai.listModels(provider);
      setModels(result);
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return { models, loading, refetch: fetchModels };
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    setLoading(true);
    try {
      const result = await window.electron.messages.send(conversationId, content);
      setMessages(prev => [...prev, result]);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const streamMessage = useCallback(async (conversationId: string, content: string, onChunk: (chunk: AIStreamChunk) => void) => {
    setLoading(true);
    try {
      const chunks = await window.electron.ai.streamChat({
        messages: [
          ...messages.map(m => ({ role: m.role, content: m.content, tool_calls: m.toolCalls, tool_call_id: m.toolCallId })),
          { role: 'user', content },
        ],
        stream: true,
      });
      for (const chunk of chunks) {
        onChunk(chunk);
      }
    } finally {
      setLoading(false);
    }
  }, [messages]);

  return { messages, setMessages, loading, sendMessage, streamMessage };
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const result = await window.electron.conversations.list();
      setConversations(result);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const createConversation = useCallback(async (title?: string) => {
    const conversation = await window.electron.conversations.create(title);
    setConversations(prev => [conversation, ...prev]);
    return conversation;
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await window.electron.conversations.delete(id);
    setConversations(prev => prev.filter(c => c.id !== id));
  }, []);

  const renameConversation = useCallback(async (id: string, title: string) => {
    await window.electron.conversations.rename(id, title);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
  }, []);

  return { conversations, loading, refetch: fetchConversations, createConversation, deleteConversation, renameConversation };
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const result = await window.electron.messages.list(conversationId);
      setMessages(result);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId) return;
    const result = await window.electron.messages.send(conversationId, content);
    setMessages(prev => [...prev, result]);
    return result;
  }, [conversationId]);

  const deleteMessage = useCallback(async (id: string) => {
    await window.electron.messages.delete(id);
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  return { messages, loading, refetch: fetchMessages, sendMessage, deleteMessage };
}

export function useMemory() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemory = useCallback(async (query?: string) => {
    try {
      const result = await window.electron.memory.list(query);
      setEntries(result);
    } catch (error) {
      console.error('Failed to fetch memory:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);

  const searchMemory = useCallback(async (query: string) => {
    try {
      return await window.electron.memory.search(query);
    } catch (error) {
      console.error('Failed to search memory:', error);
      return [];
    }
  }, []);

  const createMemory = useCallback(async (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessed'>) => {
    const result = await window.electron.memory.create(entry);
    setEntries(prev => [result, ...prev]);
    return result;
  }, []);

  const updateMemory = useCallback(async (id: string, updates: Partial<MemoryEntry>) => {
    await window.electron.memory.update(id, updates);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  const deleteMemory = useCallback(async (id: string) => {
    await window.electron.memory.delete(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  return { entries, loading, refetch: fetchMemory, searchMemory, createMemory, updateMemory, deleteMemory };
}

export function useTools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTools = useCallback(async () => {
    try {
      const result = await window.electron.tools.list();
      setTools(result);
    } catch (error) {
      console.error('Failed to fetch tools:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const executeTool = useCallback(async (name: string, args: Record<string, unknown>) => {
    return window.electron.tools.execute(name, args);
  }, []);

  return { tools, loading, refetch: fetchTools, executeTool };
}

export function useSystemMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const result = await window.electron.system.getMetrics();
      setMetrics(result);
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return { metrics, loading, refetch: fetchMetrics };
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const result = await window.electron.settings.get();
      setSettings(result);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    await window.electron.settings.set(newSettings);
    setSettings(prev => prev ? { ...prev, ...newSettings } : null);
  }, []);

  const resetSettings = useCallback(async () => {
    await window.electron.settings.reset();
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, updateSettings, resetSettings };
}

export function useVoiceState() {
  const [state, setState] = useState<VoiceState>(VoiceState.IDLE);

  useEffect(() => {
    const cleanup = window.electron.voice.onStateChange(setState);
    return cleanup;
  }, []);

  const start = useCallback(() => window.electron.voice.start(), []);
  const stop = useCallback(() => window.electron.voice.stop(), []);
  const speak = useCallback((text: string) => window.electron.voice.speak(text), []);

  return { state, start, stop, speak };
}

export function useWindowControls() {
  const minimize = useCallback(() => window.electron.window.minimize(), []);
  const maximize = useCallback(() => window.electron.window.maximize(), []);
  const close = useCallback(() => window.electron.window.close(), []);
  const toggle = useCallback(() => window.electron.window.toggle(), []);
  return { minimize, maximize, close, toggle };
}
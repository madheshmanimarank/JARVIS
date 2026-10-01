import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type {
  AIRequest, AIResponse, AIStreamChunk, ModelInfo, ProviderStatus,
  Conversation, Message, MemoryEntry, Tool, ToolResult, SystemMetrics, AppSettings, VoiceState
} from '../shared/types';
import { IPC_CHANNELS } from '../shared/constants';

const allowedChannels = [
  'ai:chat',
  'ai:stream',
  'ai:models',
  'ai:status',
  'ai:pull-model',
  'ai:delete-model',
  'voice:start',
  'voice:stop',
  'voice:tts',
  'voice:state',
  'conversations:list',
  'conversations:create',
  'conversations:delete',
  'conversations:rename',
  'messages:list',
  'messages:send',
  'messages:delete',
  'memory:list',
  'memory:search',
  'memory:create',
  'memory:update',
  'memory:delete',
  'tools:list',
  'tools:execute',
  'system:metrics',
  'system:info',
  'settings:get',
  'settings:set',
  'settings:reset',
  'window:minimize',
  'window:maximize',
  'window:close',
  'window:toggle',
  'dialog:openFile',
  'dialog:saveFile',
  'dialog:openDirectory',
  'app:getPath',
  'app:getVersion',
  'app:quit',
] as const;

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: <T>(channel: string, ...args: unknown[]): Promise<T> => {
      if (allowedChannels.includes(channel as any)) {
        return ipcRenderer.invoke(channel, ...args) as Promise<T>;
      }
      throw new Error(`Channel not allowed: ${channel}`);
    },
    send: (channel: string, ...args: unknown[]) => {
      if (allowedChannels.includes(channel as any)) {
        ipcRenderer.send(channel, ...args);
      }
    },
    on: (channel: string, func: (...args: unknown[]) => void): (() => void) => {
      if (allowedChannels.includes(channel as any)) {
        ipcRenderer.on(channel, (_event: IpcRendererEvent, ...args: unknown[]) => func(...args));
        return () => ipcRenderer.off(channel, func);
      }
      return () => {};
    },
    once: (channel: string, func: (...args: unknown[]) => void): void => {
      if (allowedChannels.includes(channel as any)) {
        ipcRenderer.once(channel, (_event: IpcRendererEvent, ...args: unknown[]) => func(...args));
      }
    },
  },
  ai: {
    chat: (request: AIRequest): Promise<AIResponse> =>
      ipcRenderer.invoke('ai:chat', request),
    streamChat: (request: AIRequest): Promise<AIStreamChunk[]> =>
      ipcRenderer.invoke('ai:stream', request),
    listModels: (provider?: string): Promise<ModelInfo[]> =>
      ipcRenderer.invoke('ai:models', provider),
    getStatus: (provider?: string): Promise<ProviderStatus | ProviderStatus[]> =>
      ipcRenderer.invoke('ai:status', provider),
    pullModel: (name: string): Promise<void> =>
      ipcRenderer.invoke('ai:pull-model', name),
    deleteModel: (name: string): Promise<void> =>
      ipcRenderer.invoke('ai:delete-model', name),
  },
  voice: {
    start: (): Promise<void> =>
      ipcRenderer.invoke('voice:start'),
    stop: (): Promise<void> =>
      ipcRenderer.invoke('voice:stop'),
    speak: (text: string): Promise<void> =>
      ipcRenderer.invoke('voice:tts', text),
    onStateChange: (callback: (state: VoiceState) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, state: VoiceState) => callback(state);
      ipcRenderer.on('voice:state', listener);
      return () => ipcRenderer.off('voice:state', listener);
    },
  },
  conversations: {
    list: (): Promise<Conversation[]> =>
      ipcRenderer.invoke('conversations:list'),
    create: (title?: string): Promise<Conversation> =>
      ipcRenderer.invoke('conversations:create', title),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('conversations:delete', id),
    rename: (id: string, title: string): Promise<void> =>
      ipcRenderer.invoke('conversations:rename', id, title),
  },
  messages: {
    list: (conversationId: string): Promise<Message[]> =>
      ipcRenderer.invoke('messages:list', conversationId),
    send: (conversationId: string, content: string): Promise<Message> =>
      ipcRenderer.invoke('messages:send', conversationId, content),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('messages:delete', id),
  },
  memory: {
    list: (query?: string, limit?: number): Promise<MemoryEntry[]> =>
      ipcRenderer.invoke('memory:list', query, limit),
    search: (query: string, limit?: number): Promise<MemoryEntry[]> =>
      ipcRenderer.invoke('memory:search', query, limit),
    create: (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessed'>): Promise<MemoryEntry> =>
      ipcRenderer.invoke('memory:create', entry),
    update: (id: string, updates: Partial<MemoryEntry>): Promise<void> =>
      ipcRenderer.invoke('memory:update', id, updates),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('memory:delete', id),
  },
  tools: {
    list: (): Promise<Tool[]> =>
      ipcRenderer.invoke('tools:list'),
    execute: (name: string, args: Record<string, unknown>): Promise<ToolResult> =>
      ipcRenderer.invoke('tools:execute', name, args),
  },
  system: {
    getMetrics: (): Promise<SystemMetrics> =>
      ipcRenderer.invoke('system:metrics'),
    getInfo: (): Promise<SystemMetrics> =>
      ipcRenderer.invoke('system:info'),
  },
  settings: {
    get: (): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:get'),
    set: (settings: Partial<AppSettings>): Promise<void> =>
      ipcRenderer.invoke('settings:set', settings),
    reset: (): Promise<void> =>
      ipcRenderer.invoke('settings:reset'),
  },
  window: {
    minimize: (): Promise<void> =>
      ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<void> =>
      ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> =>
      ipcRenderer.invoke('window:close'),
    toggle: (): Promise<void> =>
      ipcRenderer.invoke('window:toggle'),
  },
  dialog: {
    openFile: (options?: Electron.OpenDialogOptions): Promise<string[] | undefined> =>
      ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options?: Electron.SaveDialogOptions): Promise<string | undefined> =>
      ipcRenderer.invoke('dialog:saveFile', options),
    openDirectory: (options?: Electron.OpenDialogOptions): Promise<string[] | undefined> =>
      ipcRenderer.invoke('dialog:openDirectory', options),
  },
  app: {
    getPath: (name: string): Promise<string> =>
      ipcRenderer.invoke('app:getPath', name),
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke('app:getVersion'),
    quit: (): Promise<void> =>
      ipcRenderer.invoke('app:quit'),
  },
});

contextBridge.exposeInMainWorld('utils', {
  isDev: (): boolean => !process.env.NODE_ENV || process.env.NODE_ENV === 'development',
  isProd: (): boolean => process.env.NODE_ENV === 'production',
  platform: process.platform,
});

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke<T>(channel: string, ...args: unknown[]): Promise<T>;
        send(channel: string, ...args: unknown[]): void;
        on(channel: string, func: (...args: unknown[]) => void): () => void;
        once(channel: string, func: (...args: unknown[]) => void): void;
      };
      ai: {
        chat(request: AIRequest): Promise<AIResponse>;
        streamChat(request: AIRequest): Promise<AIStreamChunk[]>;
        listModels(provider?: string): Promise<ModelInfo[]>;
        getStatus(provider?: string): Promise<ProviderStatus | ProviderStatus[]>;
        pullModel(name: string): Promise<void>;
        deleteModel(name: string): Promise<void>;
      };
      voice: {
        start(): Promise<void>;
        stop(): Promise<void>;
        speak(text: string): Promise<void>;
        onStateChange(callback: (state: VoiceState) => void): () => void;
      };
      conversations: {
        list(): Promise<Conversation[]>;
        create(title?: string): Promise<Conversation>;
        delete(id: string): Promise<void>;
        rename(id: string, title: string): Promise<void>;
      };
      messages: {
        list(conversationId: string): Promise<Message[]>;
        send(conversationId: string, content: string): Promise<Message>;
        delete(id: string): Promise<void>;
      };
      memory: {
        list(query?: string, limit?: number): Promise<MemoryEntry[]>;
        search(query: string, limit?: number): Promise<MemoryEntry[]>;
        create(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessed'>): Promise<MemoryEntry>;
        update(id: string, updates: Partial<MemoryEntry>): Promise<void>;
        delete(id: string): Promise<void>;
      };
      tools: {
        list(): Promise<Tool[]>;
        execute(name: string, args: Record<string, unknown>): Promise<ToolResult>;
      };
      system: {
        getMetrics(): Promise<SystemMetrics>;
        getInfo(): Promise<SystemMetrics>;
      };
      settings: {
        get(): Promise<AppSettings>;
        set(settings: Partial<AppSettings>): Promise<void>;
        reset(): Promise<void>;
      };
      window: {
        minimize(): void;
        maximize(): void;
        close(): void;
        toggle(): void;
      };
      dialog: {
        openFile(options?: Electron.OpenDialogOptions): Promise<string[] | undefined>;
        saveFile(options?: Electron.SaveDialogOptions): Promise<string | undefined>;
        openDirectory(options?: Electron.OpenDialogOptions): Promise<string[] | undefined>;
      };
      app: {
        getPath(name: string): string;
        getVersion(): string;
        quit(): void;
      };
    };
    utils: {
      isDev(): boolean;
      isProd(): boolean;
      platform: string;
    };
  }
}
export enum AIProviderType {
  OLLAMA = 'ollama',
  GROQ = 'groq',
  AUTO = 'auto',
}

export enum AIModelMode {
  CHAT = 'chat',
  COMPLETION = 'completion',
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface AIRequest {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  responseFormat?: { type: 'json_object' } | { type: 'text' };
}

export interface AIResponse {
  id: string;
  model: string;
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
}

export interface AIStreamChunk {
  id: string;
  model: string;
  content: string;
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
  isComplete: boolean;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required: string[];
    };
  };
}

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ModelInfo {
  name: string;
  size?: number;
  digest?: string;
  modifiedAt?: string;
  details?: {
    parentModel?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameterSize?: string;
    quantizationLevel?: string;
  };
}

export interface ProviderStatus {
  type: AIProviderType;
  connected: boolean;
  latency?: number;
  models: ModelInfo[];
  error?: string;
  lastChecked: number;
}

export enum VoiceState {
  IDLE = 'idle',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  THINKING = 'thinking',
  SPEAKING = 'speaking',
  ERROR = 'error',
}

export interface VoiceConfig {
  enabled: boolean;
  ttsProvider: 'fish-audio' | 'system';
  fishAudioApiKey: string;
  fishAudioVoiceId: string;
  sttProvider: 'whisper' | 'web-speech';
  whisperModel: string;
  language: string;
  speed: number;
  autoSpeak: boolean;
}

export interface STTConfig {
  provider: 'whisper' | 'web-speech';
  model?: string;
  language?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  model?: string;
  provider?: AIProviderType;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  timestamp: number;
  metadata?: {
    model?: string;
    provider?: AIProviderType;
    tokens?: number;
    duration?: number;
  };
}

export interface MemoryEntry {
  id: string;
  type: 'fact' | 'preference' | 'context' | 'skill';
  content: string;
  tags: string[];
  importance: number;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessed: number;
  embedding?: number[];
}

export enum ToolRiskLevel {
  SAFE = 'safe',
  LOW = 'low',
  HIGH = 'high',
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
  riskLevel: ToolRiskLevel;
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  network: {
    interfaces: Array<{
      name: string;
      address: string;
      netmask: string;
      family: string;
      mac: string;
      internal: boolean;
    }>;
  };
  platform: string;
  arch: string;
  uptime: number;
  hostname: string;
}

export interface AppSettings {
  ai: {
    provider: AIProviderType;
    ollamaUrl: string;
    ollamaModel: string;
    groqApiKey: string;
    groqModel: string;
    temperature: number;
    maxTokens: number;
    stream: boolean;
    toolCalling: boolean;
  };
  voice: VoiceConfig;
  privacy: {
    localFirst: boolean;
    saveConversations: boolean;
    saveMemory: boolean;
    telemetry: boolean;
  };
  ui: {
    theme: 'dark' | 'light' | 'system';
    animations: boolean;
    compactMode: boolean;
    alwaysOnTop: boolean;
  };
  hotkey: {
    enabled: boolean;
    modifier: string[];
    key: string;
  };
  tray: {
    enabled: boolean;
    minimizeToTray: boolean;
  };
}

export interface IPCChannels {
  'ai:chat': [request: AIRequest];
  'ai:stream': [request: AIRequest];
  'ai:models': [provider?: AIProviderType];
  'ai:status': [provider?: AIProviderType];
  'ai:pull-model': [name: string];
  'ai:delete-model': [name: string];
  'voice:start': [];
  'voice:stop': [];
  'voice:tts': [text: string];
  'voice:state': [state: VoiceState];
  'conversations:list': [];
  'conversations:create': [title?: string];
  'conversations:delete': [id: string];
  'conversations:rename': [id: string, title: string];
  'messages:list': [conversationId: string];
  'messages:send': [conversationId: string, content: string];
  'messages:delete': [id: string];
  'memory:list': [query?: string, limit?: number];
  'memory:search': [query: string, limit?: number];
  'memory:create': [entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessed'>];
  'memory:update': [id: string, updates: Partial<MemoryEntry>];
  'memory:delete': [id: string];
  'tools:list': [];
  'tools:execute': [name: string, args: Record<string, unknown>];
  'system:metrics': [];
  'system:info': [];
  'settings:get': [];
  'settings:set': [settings: Partial<AppSettings>];
  'settings:reset': [];
  'window:minimize': [];
  'window:maximize': [];
  'window:close': [];
  'window:toggle': [];
  'dialog:openFile': [options?: Electron.OpenDialogOptions];
  'dialog:saveFile': [options?: Electron.SaveDialogOptions];
  'dialog:openDirectory': [options?: Electron.OpenDialogOptions];
  'app:getPath': [name: string];
  'app:getVersion': [];
  'app:quit': [];
}

export interface ElectronAPI {
  ipcRenderer: {
    invoke<T>(channel: string, ...args: unknown[]): Promise<T>;
    send(channel: string, ...args: unknown[]): void;
    on(channel: string, func: (...args: unknown[]) => void): () => void;
    once(channel: string, func: (...args: unknown[]) => void): void;
  };
  ai: {
    chat(request: AIRequest): Promise<AIResponse>;
    streamChat(request: AIRequest): AsyncGenerator<AIStreamChunk, void, unknown>;
    listModels(provider?: AIProviderType): Promise<ModelInfo[]>;
    getStatus(provider?: AIProviderType): Promise<ProviderStatus>;
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
}
import { AIProviderType, AIModelMode, VoiceState, ToolRiskLevel } from '@shared/types';

export const DEFAULT_SYSTEM_PROMPT = `You are J.A.R.V.I.S.,
Just A Rather Very Intelligent System.

You are a desktop AI assistant designed to assist the user with:
- reasoning - information - productivity - software development
- system interaction - file management - automation
- cybersecurity-related tasks - general assistance

Your personality is:
- intelligent - calm - concise - professional
- technically capable - slightly futuristic - conversational

Never claim an action was performed unless the application confirms it.
Never fabricate tool results. Never expose credentials.
Never execute destructive operations without confirmation.
Use available tools whenever a real-world operation is required.`;

export const APP_NAME = 'J.A.R.V.I.S.';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Just A Rather Very Intelligent System';

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
export const DEFAULT_OLLAMA_MODEL = 'llama3.2:3b';

export const FISH_AUDIO_DEFAULT_VOICE_ID = '2d33b07cbe1943a7957cdd43907216c8';

export const DEFAULT_SETTINGS = {
  ai: {
    provider: AIProviderType.AUTO,
    ollamaUrl: DEFAULT_OLLAMA_URL,
    ollamaModel: DEFAULT_OLLAMA_MODEL,
    groqApiKey: '',
    groqModel: DEFAULT_GROQ_MODEL,
    temperature: 0.7,
    maxTokens: 4096,
    stream: true,
    toolCalling: true,
  },
  voice: {
    enabled: true,
    ttsProvider: 'fish-audio' as const,
    fishAudioApiKey: '',
    fishAudioVoiceId: FISH_AUDIO_DEFAULT_VOICE_ID,
    sttProvider: 'whisper' as const,
    whisperModel: 'base',
    language: 'en',
    speed: 1.0,
    autoSpeak: true,
  },
  privacy: {
    localFirst: true,
    saveConversations: true,
    saveMemory: true,
    telemetry: false,
  },
  ui: {
    theme: 'dark' as const,
    animations: true,
    compactMode: false,
    alwaysOnTop: false,
  },
  hotkey: {
    enabled: true,
    modifier: ['CommandOrControl', 'Shift'],
    key: 'J',
  },
  tray: {
    enabled: true,
    minimizeToTray: true,
  },
};

export const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];

export const OLLAMA_MODELS = [
  'nemotron:70b',
  'nemotron:latest',
  'llama3.2:3b',
  'llama3.2:latest',
  'qwen2.5:3b',
  'mistral:7b',
  'codellama:7b',
];

export const TOOL_RISK_LEVELS = {
  SAFE: ToolRiskLevel.SAFE,
  LOW: ToolRiskLevel.LOW,
  HIGH: ToolRiskLevel.HIGH,
} as const;

export const VOICE_STATES = {
  IDLE: VoiceState.IDLE,
  LISTENING: VoiceState.LISTENING,
  PROCESSING: VoiceState.PROCESSING,
  THINKING: VoiceState.THINKING,
  SPEAKING: VoiceState.SPEAKING,
  ERROR: VoiceState.ERROR,
} as const;

export const DATABASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  message_count INTEGER DEFAULT 0,
  model TEXT,
  provider TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,
  tool_call_id TEXT,
  timestamp INTEGER NOT NULL,
  metadata TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

CREATE TABLE IF NOT EXISTS memory (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL,
  importance REAL DEFAULT 0.5,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  access_count INTEGER DEFAULT 0,
  last_accessed INTEGER NOT NULL,
  embedding TEXT
);

CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(type);
CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory(importance);
CREATE INDEX IF NOT EXISTS idx_memory_last_accessed ON memory(last_accessed);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  context TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
`;

export const IPC_CHANNELS = {
  'ai:chat': 'ai:chat',
  'ai:stream': 'ai:stream',
  'ai:models': 'ai:models',
  'ai:status': 'ai:status',
  'ai:pull-model': 'ai:pull-model',
  'ai:delete-model': 'ai:delete-model',
  'voice:start': 'voice:start',
  'voice:stop': 'voice:stop',
  'voice:tts': 'voice:tts',
  'voice:state': 'voice:state',
  'conversations:list': 'conversations:list',
  'conversations:create': 'conversations:create',
  'conversations:delete': 'conversations:delete',
  'conversations:rename': 'conversations:rename',
  'messages:list': 'messages:list',
  'messages:send': 'messages:send',
  'messages:delete': 'messages:delete',
  'memory:list': 'memory:list',
  'memory:search': 'memory:search',
  'memory:create': 'memory:create',
  'memory:update': 'memory:update',
  'memory:delete': 'memory:delete',
  'tools:list': 'tools:list',
  'tools:execute': 'tools:execute',
  'system:metrics': 'system:metrics',
  'system:info': 'system:info',
  'settings:get': 'settings:get',
  'settings:set': 'settings:set',
  'settings:reset': 'settings:reset',
  'window:minimize': 'window:minimize',
  'window:maximize': 'window:maximize',
  'window:close': 'window:close',
  'window:toggle': 'window:toggle',
  'dialog:openFile': 'dialog:openFile',
  'dialog:saveFile': 'dialog:saveFile',
  'dialog:openDirectory': 'dialog:openDirectory',
  'app:getPath': 'app:getPath',
  'app:getVersion': 'app:getVersion',
  'app:quit': 'app:quit',
} as const;

export { AIProviderType, AIModelMode, VoiceState, ToolRiskLevel };
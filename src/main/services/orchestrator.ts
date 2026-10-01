import { AIRouter, getAIRouter } from '@core/ai/AIRouter.js';
import { ToolManager } from '@core/tools/ToolManager.js';
import { MemoryManager } from '@core/memory/MemoryManager.js';
import { DatabaseManager } from './database.js';
import { DEFAULT_SYSTEM_PROMPT } from '@shared/constants';
import type { AIRequest, AIResponse, AIStreamChunk, AIMessage, ToolCall, Conversation, Message, MemoryEntry, AppSettings, SystemMetrics, ToolParameter } from '@shared/types';
import { ToolRiskLevel } from '@shared/types';
import { AIProviderType, VoiceState } from '@shared/types';
import { EventEmitter } from 'events';

export interface OrchestratorEvents {
  'voice-state': [state: VoiceState];
  'message': [message: Message];
  'tool-call': [toolCall: ToolCall, result: unknown];
  'error': [error: Error];
}

export class AIOrchestrator extends EventEmitter<OrchestratorEvents> {
  private router: AIRouter;
  private toolManager: ToolManager;
  private memoryManager: MemoryManager;
  private database: DatabaseManager;
  private settings: AppSettings;
  private currentConversationId: string | null = null;
  private isStreaming = false;
  private abortController: AbortController | null = null;

  constructor(settings: AppSettings) {
    super();
    this.settings = settings;
    this.router = getAIRouter() || new AIRouter({
      defaultProvider: settings.ai.provider,
      ollamaUrl: settings.ai.ollamaUrl,
      ollamaModel: settings.ai.ollamaModel,
      groqApiKey: settings.ai.groqApiKey,
      groqModel: settings.ai.groqModel,
      localFirst: settings.privacy.localFirst,
    });
    this.toolManager = new ToolManager();
    this.memoryManager = new MemoryManager();
    this.database = DatabaseManager.getInstance();
    this.registerCoreTools();
  }

  private registerCoreTools(): void {
    this.toolManager.registerTool({
      name: 'system_info',
      description: 'Get system information and metrics',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      riskLevel: ToolRiskLevel.SAFE,
      execute: async () => {
        const metrics = await this.getSystemMetrics();
        return { success: true, result: metrics };
      },
    });

    this.toolManager.registerTool({
      name: 'read_file',
      description: 'Read a file from the filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file' },
        },
        required: ['path'],
      },
      riskLevel: ToolRiskLevel.LOW,
      execute: async ({ path }) => {
        const fs = await import('fs/promises');
        try {
          const content = await fs.readFile(path as string, 'utf-8');
          return { success: true, result: content };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    });

    this.toolManager.registerTool({
      name: 'write_file',
      description: 'Write content to a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
      riskLevel: ToolRiskLevel.HIGH,
      execute: async ({ path, content }) => {
        const fs = await import('fs/promises');
        try {
          await fs.writeFile(path as string, content as string, 'utf-8');
          return { success: true, result: 'File written successfully' };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    });

    this.toolManager.registerTool({
      name: 'list_directory',
      description: 'List contents of a directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the directory' },
        },
        required: ['path'],
      },
      riskLevel: ToolRiskLevel.SAFE,
      execute: async ({ path }) => {
        const fs = await import('fs/promises');
        try {
          const entries = await fs.readdir(path as string, { withFileTypes: true });
          return {
            success: true,
            result: entries.map(e => ({
              name: e.name,
              type: e.isDirectory() ? 'directory' : 'file',
            })),
          };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    });

    this.toolManager.registerTool({
      name: 'execute_command',
      description: 'Execute a shell command',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute' },
          args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
          cwd: { type: 'string', description: 'Working directory' },
        },
        required: ['command'],
      },
      riskLevel: ToolRiskLevel.HIGH,
      execute: async ({ command, args = [], cwd }) => {
        const { spawn } = await import('child_process');
        return new Promise((resolve) => {
          const proc = spawn(command as string, args as string[], { cwd: cwd as string || process.cwd() });
          let stdout = '';
          let stderr = '';
          proc.stdout.on('data', d => stdout += d.toString());
          proc.stderr.on('data', d => stderr += d.toString());
          proc.on('close', code => {
            resolve({
              success: code === 0,
              result: { stdout, stderr, code },
              error: code !== 0 ? stderr : undefined,
            });
          });
        });
      },
    });

    this.toolManager.registerTool({
      name: 'search_memory',
      description: 'Search conversation memory',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Maximum results' },
        },
        required: ['query'],
      },
      riskLevel: ToolRiskLevel.SAFE,
      execute: async (args: Record<string, unknown>) => {
        const query = args.query as string;
        const limit = (args.limit as number) ?? 10;
        const results = await this.memoryManager.search(query, limit);
        return { success: true, result: results };
      },
    });

    this.toolManager.registerTool({
      name: 'save_memory',
      description: 'Save a memory entry',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['fact', 'preference', 'context', 'skill'] },
          content: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          importance: { type: 'number' },
        },
        required: ['type', 'content', 'tags'],
      },
      riskLevel: ToolRiskLevel.LOW,
      execute: async ({ type, content, tags, importance = 0.5 }) => {
        const entry = await this.memoryManager.create({
          type: type as 'fact' | 'preference' | 'context' | 'skill',
          content: content as string,
          tags: tags as string[],
          importance: importance as number,
        });
        return { success: true, result: entry };
      },
    });
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const provider = await this.router.selectProvider(request);
    return provider.chat(request);
  }

  async *streamChat(request: AIRequest): AsyncGenerator<AIStreamChunk, void, unknown> {
    this.isStreaming = true;
    this.abortController = new AbortController();
    const provider = await this.router.selectProvider(request);

    try {
      for await (const chunk of provider.streamChat(request)) {
        if (this.abortController?.signal.aborted) break;
        yield chunk;
      }
    } finally {
      this.isStreaming = false;
      this.abortController = null;
    }
  }

  stopStreaming(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isStreaming = false;
  }

  async sendMessage(conversationId: string, content: string): Promise<Message> {
    this.currentConversationId = conversationId;
    const conversation = this.database.getConversation(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const userMessage: Message = {
      id: crypto.randomUUID(),
      conversationId,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    if (this.settings.privacy.saveConversations) {
      this.database.createMessage(userMessage);
    }

    this.emit('message', userMessage);

    const memoryContext = await this.getRelevantMemory(content);
    const messages: AIMessage[] = [
      { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
      ...(memoryContext.length > 0 ? [{
        role: 'system' as const,
        content: `Relevant memory:\n${memoryContext.map(m => `- ${m.content}`).join('\n')}`,
      }] : []),
      ...this.getConversationHistory(conversationId).map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      { role: 'user' as const, content },
    ];

    const request: AIRequest = {
      messages,
      model: conversation.model || this.settings.ai.ollamaModel,
      temperature: this.settings.ai.temperature,
      maxTokens: this.settings.ai.maxTokens,
      stream: this.settings.ai.stream,
      tools: this.settings.ai.toolCalling ? this.toolManager.getDefinitions() : undefined,
    };

    let assistantMessage: Message;
    let fullContent = '';
    let toolCalls: ToolCall[] | undefined;

    if (this.settings.ai.stream) {
      for await (const chunk of this.streamChat(request)) {
        fullContent += chunk.content;
        if (chunk.toolCalls) toolCalls = chunk.toolCalls;
        if (chunk.finishReason === 'tool_calls' && toolCalls) {
          for (const tc of toolCalls) {
            const result = await this.toolManager.executeTool(tc.function.name, JSON.parse(tc.function.arguments));
            this.emit('tool-call', tc, result);
            messages.push({
              role: 'tool',
              content: JSON.stringify(result),
              tool_call_id: tc.id,
            });
          }
          const followUp = await this.chat({ ...request, messages, stream: false });
          fullContent = followUp.content;
          toolCalls = followUp.toolCalls;
        }
      }
    } else {
      const response = await this.chat(request);
      fullContent = response.content;
      toolCalls = response.toolCalls;
      if (toolCalls) {
        for (const tc of toolCalls) {
          const result = await this.toolManager.executeTool(tc.function.name, JSON.parse(tc.function.arguments));
          this.emit('tool-call', tc, result);
          messages.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: tc.id,
          });
        }
        const followUp = await this.chat({ ...request, messages, stream: false });
        fullContent = followUp.content;
      }
    }

    assistantMessage = {
      id: crypto.randomUUID(),
      conversationId,
      role: 'assistant',
      content: fullContent,
      toolCalls,
      timestamp: Date.now(),
      metadata: {
        model: request.model,
        provider: this.router.getCurrentProvider(),
      },
    };

    if (this.settings.privacy.saveConversations) {
      this.database.createMessage(assistantMessage);
      this.database.updateConversation(conversationId, {
        updatedAt: Date.now(),
        messageCount: conversation.messageCount + 2,
      });
    }

    this.emit('message', assistantMessage);

    return assistantMessage;
  }

  private getConversationHistory(conversationId: string, limit = 20): Message[] {
    const messages = this.database.getMessages(conversationId);
    return messages.slice(-limit);
  }

  private async getRelevantMemory(query: string): Promise<MemoryEntry[]> {
    if (!this.settings.privacy.saveMemory) return [];
    return this.memoryManager.search(query, 5);
  }

  setSettings(settings: AppSettings): void {
    this.settings = settings;
    this.router.setConfig({
      defaultProvider: settings.ai.provider,
      ollamaUrl: settings.ai.ollamaUrl,
      ollamaModel: settings.ai.ollamaModel,
      groqApiKey: settings.ai.groqApiKey,
      groqModel: settings.ai.groqModel,
      localFirst: settings.privacy.localFirst,
    });
  }

  getTools() {
    return this.toolManager.getDefinitions();
  }

  async executeTool(name: string, args: Record<string, unknown>) {
    return this.toolManager.executeTool(name, args);
  }

  getSystemMetrics(): Promise<SystemMetrics> {
    return (async () => {
      const os = await import('os');
      const cpus = os.cpus();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();

      return {
        cpu: {
          usage: 0,
          cores: cpus.length,
          loadAverage: os.loadavg(),
        },
        memory: {
          total: totalMem,
          free: freeMem,
          used: totalMem - freeMem,
          percentage: ((totalMem - freeMem) / totalMem) * 100,
        },
        disk: {
          total: 0,
          free: 0,
          used: 0,
          percentage: 0,
        },
        network: {
          interfaces: Object.entries(os.networkInterfaces() || {}).flatMap(([name, ifaces]) =>
            (ifaces || []).map(iface => ({
              name,
              address: iface.address,
              netmask: iface.netmask,
              family: iface.family,
              mac: iface.mac,
              internal: iface.internal,
            }))
          ),
        },
        platform: os.platform(),
        arch: os.arch(),
        uptime: os.uptime(),
        hostname: os.hostname(),
      };
    })();
  }

  createConversation(title = 'New Conversation'): Conversation {
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      model: this.settings.ai.ollamaModel,
      provider: this.settings.ai.provider,
    };
    this.database.createConversation(conversation);
    return conversation;
  }

  listConversations(): Conversation[] {
    return this.database.listConversations();
  }

  deleteConversation(id: string): void {
    this.database.deleteConversation(id);
  }

  renameConversation(id: string, title: string): void {
    this.database.updateConversation(id, { title, updatedAt: Date.now() });
  }

  getMessages(conversationId: string): Message[] {
    return this.database.getMessages(conversationId);
  }

  getMemoryList(query?: string, limit = 50): MemoryEntry[] {
    return this.memoryManager.list(query, limit);
  }

  getMemorySearch(query: string, limit = 20): MemoryEntry[] {
    return this.memoryManager.search(query, limit);
  }

  async createMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessed'>): Promise<MemoryEntry> {
    return this.memoryManager.create(entry);
  }

  updateMemory(id: string, updates: Partial<MemoryEntry>): void {
    this.memoryManager.update(id, updates);
  }

  deleteMemory(id: string): void {
    this.memoryManager.delete(id);
  }

  getSettings(): AppSettings {
    return this.settings;
  }

  getRouter(): AIRouter {
    return this.router;
  }
}

let orchestratorInstance: AIOrchestrator | null = null;

export function createAIOrchestrator(settings: AppSettings): AIOrchestrator {
  orchestratorInstance = new AIOrchestrator(settings);
  return orchestratorInstance;
}

export function getAIOrchestrator(): AIOrchestrator | null {
  return orchestratorInstance;
}
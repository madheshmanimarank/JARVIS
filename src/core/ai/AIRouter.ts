import { OllamaProvider } from './OllamaProvider.js';
import { GroqProvider } from './GroqProvider.js';
import { AIProvider } from './AIProvider.js';
import { AIProviderType, AIRequest, AIResponse, AIStreamChunk, ModelInfo, ProviderStatus } from '@shared/types';
import { DEFAULT_OLLAMA_URL, DEFAULT_GROQ_MODEL } from '@shared/constants';

export interface RouterConfig {
  defaultProvider: AIProviderType;
  ollamaUrl: string;
  ollamaModel: string;
  groqApiKey: string;
  groqModel: string;
  localFirst: boolean;
}

export class AIRouter {
  private ollamaProvider: OllamaProvider | null = null;
  private groqProvider: GroqProvider | null = null;
  private currentProvider: AIProviderType = AIProviderType.AUTO;
  private config: RouterConfig;
  private providerStatusCache: Map<AIProviderType, ProviderStatus> = new Map();
  private statusCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = {
      defaultProvider: AIProviderType.AUTO,
      ollamaUrl: DEFAULT_OLLAMA_URL,
      ollamaModel: '',
      groqApiKey: '',
      groqModel: DEFAULT_GROQ_MODEL,
      localFirst: true,
      ...config,
    };
    this.currentProvider = this.config.defaultProvider;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    this.ollamaProvider = new OllamaProvider(this.config.ollamaUrl, this.config.ollamaModel);
    if (this.config.groqApiKey) {
      this.groqProvider = new GroqProvider(this.config.groqApiKey, this.config.groqModel);
    }
  }

  setConfig(config: Partial<RouterConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.ollamaProvider) {
      this.ollamaProvider.setBaseUrl(this.config.ollamaUrl);
      this.ollamaProvider.setModel(this.config.ollamaModel);
    }
    if (this.groqProvider && config.groqApiKey) {
      this.groqProvider.setModel(this.config.groqModel);
    } else if (!this.groqProvider && config.groqApiKey) {
      this.groqProvider = new GroqProvider(config.groqApiKey, this.config.groqModel);
    }
  }

  getConfig(): RouterConfig {
    return { ...this.config };
  }

  getCurrentProvider(): AIProviderType {
    return this.currentProvider;
  }

  setProvider(provider: AIProviderType): void {
    this.currentProvider = provider;
  }

  async selectProvider(request?: AIRequest): Promise<AIProvider> {
    if (this.currentProvider !== AIProviderType.AUTO) {
      return this.getProvider(this.currentProvider);
    }
    return this.autoSelectProvider(request);
  }

  private async autoSelectProvider(request?: AIRequest): Promise<AIProvider> {
    const ollamaStatus = await this.getProviderStatus(AIProviderType.OLLAMA);
    const groqStatus = this.config.groqApiKey ? await this.getProviderStatus(AIProviderType.GROQ) : { connected: false } as ProviderStatus;

    if (this.config.localFirst) {
      if (ollamaStatus.connected && ollamaStatus.models.length > 0) {
        this.currentProvider = AIProviderType.OLLAMA;
        return this.getOllamaProvider();
      }
      if (groqStatus.connected) {
        this.currentProvider = AIProviderType.GROQ;
        return this.getGroqProvider();
      }
    } else {
      if (groqStatus.connected) {
        this.currentProvider = AIProviderType.GROQ;
        return this.getGroqProvider();
      }
      if (ollamaStatus.connected && ollamaStatus.models.length > 0) {
        this.currentProvider = AIProviderType.OLLAMA;
        return this.getOllamaProvider();
      }
    }

    if (ollamaStatus.connected) {
      this.currentProvider = AIProviderType.OLLAMA;
      return this.getOllamaProvider();
    }
    if (groqStatus.connected) {
      this.currentProvider = AIProviderType.GROQ;
      return this.getGroqProvider();
    }

    throw new Error('No AI provider available');
  }

  private getProvider(type: AIProviderType): AIProvider {
    switch (type) {
      case AIProviderType.OLLAMA:
        return this.getOllamaProvider();
      case AIProviderType.GROQ:
        return this.getGroqProvider();
      default:
        throw new Error(`Unknown provider: ${type}`);
    }
  }

  private getOllamaProvider(): OllamaProvider {
    if (!this.ollamaProvider) {
      this.ollamaProvider = new OllamaProvider(this.config.ollamaUrl, this.config.ollamaModel);
    }
    return this.ollamaProvider;
  }

  private getGroqProvider(): GroqProvider {
    if (!this.groqProvider) {
      if (!this.config.groqApiKey) {
        throw new Error('Groq API key not configured');
      }
      this.groqProvider = new GroqProvider(this.config.groqApiKey, this.config.groqModel);
    }
    return this.groqProvider;
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const provider = await this.selectProvider(request);
    return provider.chat(request);
  }

  async *streamChat(request: AIRequest): AsyncGenerator<AIStreamChunk, void, unknown> {
    const provider = await this.selectProvider(request);
    yield* provider.streamChat(request);
  }

  async listModels(providerType?: AIProviderType): Promise<ModelInfo[]> {
    if (providerType) {
      const provider = this.getProvider(providerType);
      return provider.listModels();
    }
    const [ollamaModels, groqModels] = await Promise.allSettled([
      this.ollamaProvider?.listModels() || [],
      this.groqProvider?.listModels() || [],
    ]);
    return [
      ...(ollamaModels.status === 'fulfilled' ? ollamaModels.value : []),
      ...(groqModels.status === 'fulfilled' ? groqModels.value : []),
    ];
  }

  async getProviderStatus(providerType: AIProviderType): Promise<ProviderStatus> {
    const cached = this.providerStatusCache.get(providerType);
    if (cached && Date.now() - cached.lastChecked < 30000) {
      return cached;
    }

    let status: ProviderStatus;
    switch (providerType) {
      case AIProviderType.OLLAMA:
        status = await this.ollamaProvider?.getStatus() || {
          type: AIProviderType.OLLAMA,
          connected: false,
          models: [],
          error: 'Not initialized',
          lastChecked: Date.now(),
        };
        break;
      case AIProviderType.GROQ:
        status = await this.groqProvider?.getStatus() || {
          type: AIProviderType.GROQ,
          connected: false,
          models: [],
          error: 'Not initialized',
          lastChecked: Date.now(),
        };
        break;
      default:
        status = {
          type: providerType,
          connected: false,
          models: [],
          error: 'Unknown provider',
          lastChecked: Date.now(),
        };
    }

    this.providerStatusCache.set(providerType, status);
    return status;
  }

  async getAllProviderStatuses(): Promise<ProviderStatus[]> {
    return Promise.all([
      this.getProviderStatus(AIProviderType.OLLAMA),
      this.getProviderStatus(AIProviderType.GROQ),
    ]);
  }

  startStatusPolling(intervalMs: number = 30000): void {
    if (this.statusCheckInterval) return;
    this.statusCheckInterval = setInterval(() => {
      this.getAllProviderStatuses().catch(console.error);
    }, intervalMs);
  }

  stopStatusPolling(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  async pullOllamaModel(name: string): Promise<void> {
    return this.getOllamaProvider().pullModel(name);
  }

  async deleteOllamaModel(name: string): Promise<void> {
    return this.getOllamaProvider().deleteModel(name);
  }

  getOllamaUrl(): string {
    return this.config.ollamaUrl;
  }

  setOllamaUrl(url: string): void {
    this.config.ollamaUrl = url;
    if (this.ollamaProvider) this.ollamaProvider.setBaseUrl(url);
  }

  getGroqApiKey(): string {
    return this.config.groqApiKey;
  }

  setGroqApiKey(key: string): void {
    this.config.groqApiKey = key;
    if (key) {
      this.groqProvider = new GroqProvider(key, this.config.groqModel);
    } else {
      this.groqProvider = null;
    }
  }

  destroy(): void {
    this.stopStatusPolling();
  }
}

let routerInstance: AIRouter | null = null;

export function createAIRouter(config?: Partial<RouterConfig>): AIRouter {
  routerInstance = new AIRouter(config);
  return routerInstance;
}

export function getAIRouter(): AIRouter | null {
  return routerInstance;
}
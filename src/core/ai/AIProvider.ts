import { AIProviderType, AIRequest, AIResponse, AIStreamChunk, ModelInfo, ProviderStatus, ToolDefinition } from '@shared/types';

export abstract class AIProvider {
  protected abstract type: AIProviderType;
  protected baseUrl: string;
  protected model: string;
  protected apiKey?: string;

  constructor(baseUrl: string, model: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.apiKey = apiKey;
  }

  abstract chat(request: AIRequest): Promise<AIResponse>;
  abstract streamChat(request: AIRequest): AsyncGenerator<AIStreamChunk, void, unknown>;
  abstract listModels(): Promise<ModelInfo[]>;
  abstract checkConnection(): Promise<boolean>;
  abstract getStatus(): Promise<ProviderStatus>;

  getType(): AIProviderType {
    return this.type;
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string): void {
    this.model = model;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  protected buildMessages(request: AIRequest) {
    return request.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      tool_calls: msg.tool_calls,
      tool_call_id: msg.tool_call_id,
      name: msg.name,
    }));
  }

  protected buildTools(tools?: ToolDefinition[]): unknown[] | undefined {
    if (!tools) return undefined;
    return tools.map(t => ({
      type: 'function',
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly type: AIProviderType,
    public readonly code?: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class ModelNotFoundError extends ProviderError {
  constructor(type: AIProviderType, model: string) {
    super(`Model not found: ${model}`, type, 'MODEL_NOT_FOUND', 404);
    this.name = 'ModelNotFoundError';
  }
}

export class AuthenticationError extends ProviderError {
  constructor(type: AIProviderType) {
    super('Authentication failed', type, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends ProviderError {
  constructor(type: AIProviderType, public readonly retryAfter?: number) {
    super('Rate limit exceeded', type, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
  }
}

export class ConnectionError extends ProviderError {
  constructor(type: AIProviderType, message: string) {
    super(message, type, 'CONNECTION_ERROR', 0);
    this.name = 'ConnectionError';
  }
}
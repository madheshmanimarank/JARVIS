import axios, { AxiosInstance } from 'axios';
import { AIProvider, ProviderError, ModelNotFoundError, AuthenticationError, RateLimitError, ConnectionError } from './AIProvider.js';
import { AIProviderType, AIRequest, AIResponse, AIStreamChunk, ModelInfo, ProviderStatus, ToolDefinition } from '@shared/types';

interface OllamaChatResponse {
  id?: string;
  model: string;
  message?: {
    role: string;
    content: string;
    tool_calls?: Array<{
      id?: string;
      function: { name: string; arguments: Record<string, unknown> };
    }>;
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  done: boolean;
}

interface OllamaStreamChunk {
  id?: string;
  model: string;
  message?: {
    role: string;
    content: string;
    tool_calls?: Array<{
      id?: string;
      function: { name: string; arguments: Record<string, unknown> };
    }>;
  };
  done: boolean;
}

interface OllamaModelsResponse {
  models: Array<{
    name: string;
    size?: number;
    digest?: string;
    modified_at?: string;
    details?: any;
  }>;
}

export class OllamaProvider extends AIProvider {
  protected type = AIProviderType.OLLAMA;
  private client: AxiosInstance;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = '') {
    super(baseUrl, model);
    this.client = axios.create({
      baseURL: this.getBaseUrl(),
      timeout: 120000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    try {
      const response = await this.client.post<OllamaChatResponse>('/api/chat', {
        model: request.model || this.getModel(),
        messages: this.buildMessages(request),
        stream: false,
        tools: this.buildTools(request.tools),
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 4096,
        },
      });

      const data = response.data;
      return {
        id: data.id || crypto.randomUUID(),
        model: data.model,
        content: data.message?.content || '',
        toolCalls: data.message?.tool_calls?.map((tc) => ({
          id: tc.id || crypto.randomUUID(),
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: JSON.stringify(tc.function.arguments),
          },
        })),
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        finishReason: data.done ? 'stop' : 'length',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *streamChat(request: AIRequest): AsyncGenerator<AIStreamChunk, void, unknown> {
    try {
      const response = await this.client.post('/api/chat', {
        model: request.model || this.getModel(),
        messages: this.buildMessages(request),
        stream: true,
        tools: this.buildTools(request.tools),
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 4096,
        },
      }, {
        responseType: 'stream',
      });

      for await (const chunk of this.parseStream(response.data)) {
        const data = chunk as unknown as OllamaStreamChunk;

        yield {
          id: data.id || crypto.randomUUID(),
          model: data.model,
          content: data.message?.content || '',
          toolCalls: data.message?.tool_calls?.map((tc) => ({
            id: tc.id || crypto.randomUUID(),
            type: 'function',
            function: {
              name: tc.function.name,
              arguments: JSON.stringify(tc.function.arguments),
            },
          })),
          finishReason: data.done ? 'stop' : undefined,
          isComplete: data.done,
        };

        if (data.done) break;
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async *parseStream(stream: NodeJS.ReadableStream): AsyncGenerator<Record<string, unknown>> {
    let buffer = '';
    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          try {
            yield JSON.parse(line);
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer);
      } catch {
        // Ignore
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.get('/api/tags');
      return (response.data.models || []).map((m: any) => ({
        name: m.name,
        size: m.size,
        digest: m.digest,
        modifiedAt: m.modified_at,
        details: m.details,
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.client.get('/api/tags', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<ProviderStatus> {
    const start = Date.now();
    const connected = await this.checkConnection();
    const latency = Date.now() - start;
    let models: ModelInfo[] = [];
    let error: string | undefined;

    if (connected) {
      try {
        models = await this.listModels();
      } catch (e) {
        error = (e as Error).message;
      }
    } else {
      error = 'Connection failed';
    }

    return {
      type: this.type,
      connected,
      latency,
      models,
      error,
      lastChecked: Date.now(),
    };
  }

  async pullModel(name: string): Promise<void> {
    try {
      await this.client.post('/api/pull', { name, stream: false }, { timeout: 600000 });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteModel(name: string): Promise<void> {
    try {
      await this.client.delete('/api/delete', { data: { name } });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async showModelInfo(name: string): Promise<ModelInfo | null> {
    try {
      const response = await this.client.post('/api/show', { name });
      return {
        name: response.data.name,
        size: response.data.size,
        digest: response.data.digest,
        modifiedAt: response.data.modified_at,
        details: response.data.details,
      };
    } catch {
      return null;
    }
  }

  private handleError(error: unknown): ProviderError {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return new ConnectionError(this.type, `Cannot connect to Ollama at ${this.getBaseUrl()}`);
      }
      if (error.response?.status === 404) {
        return new ModelNotFoundError(this.type, this.getModel());
      }
      if (error.response?.status === 401) {
        return new AuthenticationError(this.type);
      }
      if (error.response?.status === 429) {
        return new RateLimitError(this.type, error.response.headers['retry-after'] ? parseInt(error.response.headers['retry-after']) : undefined);
      }
      return new ProviderError(
        error.response?.data?.error || error.message,
        this.type,
        'API_ERROR',
        error.response?.status
      );
    }
    return new ProviderError((error as Error).message, this.type, 'UNKNOWN');
  }
}
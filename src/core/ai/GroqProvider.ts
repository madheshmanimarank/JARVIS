import axios, { AxiosInstance } from 'axios';
import { AIProvider, ProviderError, ModelNotFoundError, AuthenticationError, RateLimitError, ConnectionError } from './AIProvider.js';
import { AIProviderType, AIRequest, AIResponse, AIStreamChunk, ModelInfo, ProviderStatus, ToolDefinition } from '@shared/types';

interface GroqChatResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GroqStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string | null;
  }>;
}

interface GroqModelsResponse {
  data: Array<{
    id: string;
    created: number;
    owned_by: string;
  }>;
}

export class GroqProvider extends AIProvider {
  protected type = AIProviderType.GROQ;
  private client: AxiosInstance;

  constructor(apiKey: string, model: string = 'llama-3.3-70b-versatile') {
    super('https://api.groq.com/openai/v1', model, apiKey);
    this.client = axios.create({
      baseURL: this.getBaseUrl(),
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    try {
      const response = await this.client.post<GroqChatResponse>('/chat/completions', {
        model: request.model || this.getModel(),
        messages: this.buildMessages(request),
        stream: false,
        tools: this.buildTools(request.tools),
        tool_choice: request.toolChoice,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        response_format: request.responseFormat,
      });

      const data = response.data;
      const choice = data.choices[0];
      return {
        id: data.id,
        model: data.model,
        content: choice.message?.content || '',
        toolCalls: choice.message?.tool_calls?.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        finishReason: (choice.finish_reason as 'stop' | 'length' | 'tool_calls' | 'error') || 'stop',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *streamChat(request: AIRequest): AsyncGenerator<AIStreamChunk, void, unknown> {
    try {
      const response = await this.client.post('/chat/completions', {
        model: request.model || this.getModel(),
        messages: this.buildMessages(request),
        stream: true,
        tools: this.buildTools(request.tools),
        tool_choice: request.toolChoice,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
      }, {
        responseType: 'stream',
      });

      let accumulatedToolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];

      for await (const chunk of this.parseStream(response.data)) {
        const data = chunk as unknown as GroqStreamChunk;
        if (!data.choices || data.choices.length === 0) continue;
        const choice = data.choices[0];
        const delta = choice.delta;

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.index !== undefined) {
              if (!accumulatedToolCalls[tc.index]) {
                accumulatedToolCalls[tc.index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
              }
              if (tc.id) accumulatedToolCalls[tc.index].id = tc.id;
              if (tc.function?.name) accumulatedToolCalls[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) accumulatedToolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }

        yield {
          id: data.id,
          model: data.model,
          content: delta?.content || '',
          toolCalls: accumulatedToolCalls.filter(tc => tc.id).map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
          finishReason: (choice.finish_reason as 'stop' | 'length' | 'tool_calls' | 'error' | undefined) || undefined,
          isComplete: !!choice.finish_reason,
        };

        if (choice.finish_reason) break;
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
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          if (data) {
            try {
              yield JSON.parse(data);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.get<GroqModelsResponse>('/models');
      return (response.data.data || []).map((m) => ({
        name: m.id,
        size: undefined,
        digest: undefined,
        modifiedAt: m.created ? new Date(m.created * 1000).toISOString() : undefined,
        details: undefined,
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.client.get('/models', { timeout: 5000 });
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

  private handleError(error: unknown): ProviderError {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return new ConnectionError(this.type, 'Cannot connect to Groq API');
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
        error.response?.data?.error?.message || error.message,
        this.type,
        'API_ERROR',
        error.response?.status
      );
    }
    return new ProviderError((error as Error).message, this.type, 'UNKNOWN');
  }
}
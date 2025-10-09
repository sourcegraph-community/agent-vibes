import type { OllamaSummarizerConfig, SummaryRequest, SummaryProcessingResult, OllamaGenerateRequest, OllamaGenerateResponse } from './types';

export class OllamaSummarizer {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;

  constructor(config?: OllamaSummarizerConfig) {
    this.baseUrl = config?.baseUrl ?? 'http://localhost:11434';
    this.model = config?.model ?? 'llama3.1:8b';
    this.maxRetries = config?.maxRetries ?? 3;
    this.timeoutMs = config?.timeoutMs ?? 30000;
  }

  async generateSummary(request: SummaryRequest): Promise<SummaryProcessingResult> {
    const startTime = Date.now();

    try {
      const prompt = this.buildSummaryPrompt({
        content: request.content,
        title: request.title,
        author: request.author,
      });

      let attempt = 0;
      let delayMs = 1000;

      while (true) {
        const result = await this.callOllamaApi(prompt);
        const latencyMs = Date.now() - startTime;

        if (result.success) {
          return {
            success: true,
            summary: {
              ...result.summary!,
              latencyMs,
            },
            latencyMs,
          };
        }

        if (result.error?.retryable && attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 2;
          attempt += 1;
          continue;
        }

        return {
          success: false,
          error: result.error,
          latencyMs,
        };
      }
    }
    catch (error) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          retryable: false,
        },
        latencyMs,
      };
    }
  }

  private buildSummaryPrompt(params: {
    content: string;
    title?: string | null;
    author?: string | null;
  }): string {
    const parts: string[] = [];

    if (params.title) {
      parts.push(`Title: ${params.title}`);
    }

    if (params.author) {
      parts.push(`Author: ${params.author}`);
    }

    parts.push(`\nContent:\n${params.content}`);

    const contextInfo = parts.join('\n');

    return `Summarize this article in 2-3 sentences, focusing on the key points and main takeaways. Be concise and informative.

${contextInfo}

Summary:`;
  }

  private async callOllamaApi(prompt: string): Promise<SummaryProcessingResult> {
    const url = `${this.baseUrl}/api/generate`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const requestBody: OllamaGenerateRequest = {
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 256,
          top_p: 0.9,
          top_k: 40,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        const isServerError = response.status >= 500;
        const isConnectionError = response.status === 503 || response.status === 504;

        console.error('[OllamaSummarizer] HTTP error', {
          status: response.status,
          isServerError,
          isConnectionError,
          snippet: errorText?.slice(0, 400),
        });

        return {
          success: false,
          error: {
            code: isConnectionError ? 'CONNECTION_ERROR' : isServerError ? 'SERVER_ERROR' : 'API_ERROR',
            message: `Ollama API error (${response.status}): ${errorText}`,
            retryable: isServerError || isConnectionError,
          },
          latencyMs: 0,
        };
      }

      const data: OllamaGenerateResponse = await response.json();

      if (!data.response || data.response.trim().length === 0) {
        console.error('[OllamaSummarizer] Empty response from Ollama');
        return {
          success: false,
          error: {
            code: 'EMPTY_RESPONSE',
            message: 'Ollama API returned empty response',
            retryable: true,
          },
          latencyMs: 0,
        };
      }

      const summary = data.response.trim();

      return {
        success: true,
        summary: {
          summary,
          model: this.model,
          latencyMs: 0,
        },
        latencyMs: 0,
      };
    }
    catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: `Request timed out after ${this.timeoutMs}ms`,
            retryable: true,
          },
          latencyMs: 0,
        };
      }

      if (error instanceof Error && (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED'))) {
        return {
          success: false,
          error: {
            code: 'CONNECTION_REFUSED',
            message: `Cannot connect to Ollama at ${this.baseUrl}. Is Ollama running?`,
            retryable: false,
          },
          latencyMs: 0,
        };
      }

      throw error;
    }
  }
}

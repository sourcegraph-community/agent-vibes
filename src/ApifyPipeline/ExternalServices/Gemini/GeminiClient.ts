import type { GeminiClientConfig, GeminiApiResponse, SentimentResponse, SentimentProcessingResult, SentimentRequest } from './types';
import { buildSentimentPrompt, SYSTEM_INSTRUCTION } from './promptTemplate';
import { retry } from '../../Infrastructure/Utilities/retry';

export class GeminiClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(config: GeminiClientConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gemini-2.5-flash';
    this.maxRetries = config.maxRetries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  async analyzeSentiment(request: SentimentRequest): Promise<SentimentProcessingResult> {
    const startTime = Date.now();

    try {
      const prompt = buildSentimentPrompt({
        content: request.content,
        authorHandle: request.authorHandle,
        language: request.language,
      });

      const result = await retry(
        async () => this.callGeminiApi(prompt),
        {
          retries: this.maxRetries,
          minTimeoutMs: 1000,
          factor: 2,
        },
      );

      const latencyMs = Date.now() - startTime;

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          latencyMs,
        };
      }

      return {
        success: true,
        sentiment: result.sentiment,
        tokenUsage: result.tokenUsage,
        latencyMs,
      };
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

  private async callGeminiApi(prompt: string): Promise<SentimentProcessingResult> {
    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          systemInstruction: {
            parts: [
              {
                text: SYSTEM_INSTRUCTION,
              },
            ],
          },
          generationConfig: {
            temperature: 0.2,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 256,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        const isRateLimitError = response.status === 429;
        const isServerError = response.status >= 500;

        return {
          success: false,
          error: {
            code: isRateLimitError ? 'RATE_LIMIT' : isServerError ? 'SERVER_ERROR' : 'API_ERROR',
            message: `Gemini API error (${response.status}): ${errorText}`,
            retryable: isRateLimitError || isServerError,
          },
          latencyMs: 0,
        };
      }

      const data: GeminiApiResponse = await response.json();

      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE',
            message: 'Gemini API returned empty or invalid response',
            retryable: false,
          },
          latencyMs: 0,
        };
      }

      const responseText = data.candidates[0].content.parts[0].text;
      let sentiment: SentimentResponse;

      try {
        sentiment = JSON.parse(responseText);
      }
      catch {
        return {
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: 'Failed to parse JSON response from Gemini',
            retryable: false,
          },
          latencyMs: 0,
        };
      }

      if (!sentiment.label || !['positive', 'neutral', 'negative'].includes(sentiment.label)) {
        return {
          success: false,
          error: {
            code: 'INVALID_LABEL',
            message: `Invalid sentiment label: ${sentiment.label}`,
            retryable: false,
          },
          latencyMs: 0,
        };
      }

      if (typeof sentiment.score !== 'number' || sentiment.score < -1 || sentiment.score > 1) {
        sentiment.score = this.labelToScore(sentiment.label);
      }

      return {
        success: true,
        sentiment,
        tokenUsage: data.usageMetadata
          ? {
            prompt: data.usageMetadata.promptTokenCount,
            completion: data.usageMetadata.candidatesTokenCount,
            total: data.usageMetadata.totalTokenCount,
          }
          : undefined,
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

      throw error;
    }
  }

  private labelToScore(label: 'positive' | 'neutral' | 'negative'): number {
    switch (label) {
      case 'positive':
        return 0.7;
      case 'neutral':
        return 0.0;
      case 'negative':
        return -0.7;
    }
  }
}

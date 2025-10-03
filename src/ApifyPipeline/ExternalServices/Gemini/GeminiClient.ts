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

      let attempt = 0;
      let delayMs = 1000;
      while (true) {
        const result = await this.callGeminiApi(prompt);
        const latencyMs = Date.now() - startTime;

        if (result.success) {
          return {
            success: true,
            sentiment: result.sentiment,
            tokenUsage: result.tokenUsage,
            latencyMs,
          };
        }

        if (result.error?.retryable && attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
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
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 512,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                label: {
                  type: 'STRING',
                  enum: ['positive', 'neutral', 'negative'],
                },
                score: {
                  type: 'NUMBER',
                  minimum: -1.0,
                  maximum: 1.0,
                },
                summary: {
                  type: 'STRING',
                  nullable: true,
                },
              },
              required: ['label', 'score'],
              propertyOrdering: ['label', 'score', 'summary'],
            },
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        const isRateLimitError = response.status === 429;
        const isServerError = response.status >= 500;

        console.error('[GeminiClient] HTTP error', {
          status: response.status,
          isRateLimitError,
          isServerError,
          snippet: errorText?.slice(0, 400),
        });

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

      type CandidatePart = { text?: string };
      type Candidate = { finishReason?: string; content: { parts: CandidatePart[] } };
      const data: GeminiApiResponse & { candidates?: Candidate[] } = await response.json();

      // Prompt-level block
      if (data.promptFeedback?.blockReason) {
        console.error('[GeminiClient] Prompt blocked', data.promptFeedback);
        return {
          success: false,
          error: {
            code: 'PROMPT_BLOCKED',
            message: 'Prompt blocked by safety filters',
            retryable: false,
          },
          latencyMs: 0,
        };
      }

      const finish = data.candidates?.[0]?.finishReason;
      if (finish && finish !== 'STOP') {
        if (finish === 'SAFETY' || finish === 'RECITATION' || finish === 'BLOCKLIST') {
          return {
            success: false,
            error: {
              code: 'RESPONSE_BLOCKED',
              message: `Response blocked: ${finish}`,
              retryable: false,
            },
            latencyMs: 0,
          };
        }
        if (finish === 'MAX_TOKENS') {
          return {
            success: false,
            error: {
              code: 'MAX_TOKENS',
              message: 'Response truncated at max tokens',
              retryable: true,
            },
            latencyMs: 0,
          };
        }
        // Unknown finish reason: treat as transient
        return {
          success: false,
          error: {
            code: 'FINISH_OTHER',
            message: `Non-STOP finish: ${finish}`,
            retryable: true,
          },
          latencyMs: 0,
        };
      }

      const parts: CandidatePart[] = data.candidates?.[0]?.content?.parts ?? [];
      const textCandidate = parts.map(p => p.text).find((t): t is string => typeof t === 'string' && t.trim().length > 0);

      if (!textCandidate) {
        console.error('[GeminiClient] Empty parts[] in response', {
          partsCount: parts.length,
          partsPreview: JSON.stringify(parts).slice(0, 400),
        });
        return {
          success: false,
          error: {
            code: 'EMPTY_RESPONSE',
            message: 'Gemini API returned empty response',
            retryable: true,
          },
          latencyMs: 0,
        };
      }

      let responseText = String(textCandidate).trim();
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```(?:json)?\n?/i, '').replace(/```\s*$/i, '').trim();
      }

      let sentiment: SentimentResponse;

      try {
        sentiment = JSON.parse(responseText);
      }
      catch {
        console.error('[GeminiClient] PARSE_ERROR. Response text preview:', responseText.slice(0, 200));
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
            message: 'Invalid sentiment label',
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

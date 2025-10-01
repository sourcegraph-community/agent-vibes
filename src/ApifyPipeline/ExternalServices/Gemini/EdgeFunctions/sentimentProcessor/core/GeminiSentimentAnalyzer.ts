import type { SentimentResult } from '../types.ts';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface AnalyzeSentimentInput {
  content: string;
  authorHandle: string | null;
  language: string | null;
}

export interface GeminiAnalyzerConfig {
  apiKey: string;
  model: string;
}

const SYSTEM_INSTRUCTION = `You are a sentiment analysis system for social media posts about coding agents.
Return structured JSON with fields:
{ "label": "positive|neutral|negative", "score": number between -1 and 1, "summary": short string }.
Keep answers deterministic and avoid additional text.`;

export class GeminiSentimentAnalyzer {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: GeminiAnalyzerConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  async analyze(input: AnalyzeSentimentInput): Promise<SentimentResult> {
    const promptPayload = {
      contents: [
        {
          parts: [
            {
              text: buildPrompt(input.content, input.authorHandle, input.language),
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
    };

    const start = Date.now();

    const response = await fetch(`${GEMINI_BASE_URL}/${this.model}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(promptPayload),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      const retryable = response.status === 429 || response.status >= 500;

      return {
        success: false,
        retryable,
        latencyMs,
        code: retryable ? 'RETRYABLE_HTTP_ERROR' : 'HTTP_ERROR',
        message: `Gemini responded with ${response.status}: ${text}`,
      };
    }

    const payload = await response.json() as Record<string, unknown>;
    const candidate = (payload.candidates?.[0]?.content?.parts?.[0]?.text ?? null) as string | null;

    if (!candidate) {
      return {
        success: false,
        retryable: false,
        latencyMs,
        code: 'EMPTY_RESPONSE',
        message: 'Gemini returned an empty response',
      };
    }

    try {
      const parsed = JSON.parse(candidate) as {
        label?: 'positive' | 'neutral' | 'negative';
        score?: number;
        summary?: string | null;
      };

      if (!parsed.label || !['positive', 'neutral', 'negative'].includes(parsed.label)) {
        return {
          success: false,
          retryable: false,
          latencyMs,
          code: 'INVALID_LABEL',
          message: `Invalid label: ${parsed.label}`,
        };
      }

      const safeScore = typeof parsed.score === 'number' ? parsed.score : labelToScore(parsed.label);

      const usage = payload.usageMetadata as
        | { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
        | undefined;

      return {
        success: true,
        label: parsed.label,
        score: Math.max(-1, Math.min(1, safeScore)),
        summary: parsed.summary ?? null,
        latencyMs,
        promptTokens: usage?.promptTokenCount,
        completionTokens: usage?.candidatesTokenCount,
        totalTokens: usage?.totalTokenCount,
      };
    }
    catch (error) {
      return {
        success: false,
        retryable: false,
        latencyMs,
        code: 'PARSE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to parse response',
      };
    }
  }
}

const buildPrompt = (content: string, authorHandle: string | null, language: string | null): string => {
  const handlePart = authorHandle ? `Author handle: ${authorHandle}\n` : '';
  const languagePart = language ? `Language: ${language}\n` : '';

  return [
    'Classify the sentiment of the following tweet about coding agents.',
    'Respond as JSON with keys label (positive|neutral|negative), score (-1..1), summary (short explanation).',
    handlePart,
    languagePart,
    'Tweet content:',
    content.slice(0, 2000),
  ]
    .filter(Boolean)
    .join('\n');
};

const labelToScore = (label: 'positive' | 'neutral' | 'negative'): number => {
  switch (label) {
    case 'positive':
      return 0.7;
    case 'neutral':
      return 0;
    case 'negative':
      return -0.7;
  }
};

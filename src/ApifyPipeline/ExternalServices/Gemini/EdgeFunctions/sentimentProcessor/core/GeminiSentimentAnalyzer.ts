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
            label: { type: 'STRING', enum: ['positive', 'neutral', 'negative'] },
            score: { type: 'NUMBER', minimum: -1.0, maximum: 1.0 },
            summary: { type: 'STRING', nullable: true },
          },
          required: ['label', 'score'],
          propertyOrdering: ['label', 'score', 'summary'],
        },
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

    const payload = await response.json() as Record<string, any>;

    if (payload?.promptFeedback?.blockReason) {
      console.error('Prompt blocked', payload.promptFeedback);
      return {
        success: false,
        retryable: false,
        latencyMs,
        code: 'PROMPT_BLOCKED',
        message: String(payload.promptFeedback.blockReason),
      };
    }

    const finish = payload?.candidates?.[0]?.finishReason as string | undefined;
    if (finish && finish !== 'STOP') {
      if (finish === 'SAFETY' || finish === 'RECITATION' || finish === 'BLOCKLIST') {
        return {
          success: false,
          retryable: false,
          latencyMs,
          code: 'RESPONSE_BLOCKED',
          message: `Response blocked: ${finish}`,
        };
      }
      if (finish === 'MAX_TOKENS') {
        return {
          success: false,
          retryable: true,
          latencyMs,
          code: 'MAX_TOKENS',
          message: 'Response truncated at max tokens',
        };
      }
      return {
        success: false,
        retryable: true,
        latencyMs,
        code: 'FINISH_OTHER',
        message: `Non-STOP finish: ${finish}`,
      };
    }

    const candidateText = payload?.candidates?.[0]?.content?.parts?.find((p: any) => typeof p?.text === 'string' && p.text.trim())?.text as string | null;

    if (!candidateText) {
      console.error('Empty parts[] in response', JSON.stringify(payload?.candidates?.[0]?.content?.parts ?? []).slice(0, 400));
      return {
        success: false,
        retryable: true,
        latencyMs,
        code: 'EMPTY_RESPONSE',
        message: 'Gemini returned an empty response',
      };
    }

    const cleaned = candidateText.startsWith('```')
      ? candidateText.replace(/^```(?:json)?\n?/i, '').replace(/```\s*$/i, '').trim()
      : candidateText;

    try {
      const parsed = JSON.parse(cleaned) as {
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
      console.error('PARSE_ERROR preview:', cleaned.slice(0, 200));
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

export interface SummarizerConfig {
  baseUrl: string;
  model: string;
  maxTokens?: number;
}

export interface SummaryRequest {
  title: string;
  content: string;
  url?: string;
}

export interface SummaryResponse {
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  topics: string[];
  modelVersion: string;
  latencyMs: number;
}

export class SummarizerClient {
  private readonly config: SummarizerConfig;

  constructor(config: SummarizerConfig) {
    this.config = config;
  }

  async generateSummary(request: SummaryRequest): Promise<SummaryResponse> {
    const startTime = Date.now();

    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: this.buildPrompt(request),
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: this.config.maxTokens ?? 500,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Summarizer API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { response: string };
    const latencyMs = Date.now() - startTime;

    const parsed = this.parseResponse(data.response);

    return {
      ...parsed,
      modelVersion: this.config.model,
      latencyMs,
    };
  }

  private buildPrompt(request: SummaryRequest): string {
    return `Summarize the following article and extract key information.

Title: ${request.title}
Content: ${request.content}

Provide the response in the following JSON format:
{
  "summary": "A concise 2-3 sentence summary",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "sentiment": "positive|neutral|negative",
  "topics": ["Topic 1", "Topic 2"]
}`;
  }

  private parseResponse(response: string): Omit<SummaryResponse, 'modelVersion' | 'latencyMs'> {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        summary?: string;
        keyPoints?: string[];
        sentiment?: string;
        topics?: string[];
      };

      return {
        summary: parsed.summary ?? '',
        keyPoints: parsed.keyPoints ?? [],
        sentiment: this.validateSentiment(parsed.sentiment),
        topics: parsed.topics ?? [],
      };
    } catch {
      return {
        summary: response.substring(0, 500),
        keyPoints: [],
        sentiment: null,
        topics: [],
      };
    }
  }

  private validateSentiment(value: unknown): 'positive' | 'neutral' | 'negative' | null {
    if (value === 'positive' || value === 'neutral' || value === 'negative') {
      return value;
    }
    return null;
  }
}

export const createSummarizerClient = (): SummarizerClient => {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL ?? 'llama3.1:8b';

  return new SummarizerClient({ baseUrl, model });
};

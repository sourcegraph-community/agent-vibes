import type { SentimentLabel } from './types';

export interface PromptContext {
  content: string;
  authorHandle?: string | null;
  language?: string | null;
}

export const SENTIMENT_LABELS: readonly SentimentLabel[] = ['positive', 'neutral', 'negative'] as const;

export const buildSentimentPrompt = (context: PromptContext): string => {
  const { content, authorHandle, language } = context;

  const authorInfo = authorHandle ? `\nAuthor: @${authorHandle}` : '';
  const langInfo = language ? `\nLanguage: ${language}` : '';

  return `Analyze the sentiment of this tweet about coding agents or AI development tools.

Tweet Content:
"${content}"${authorInfo}${langInfo}

Classify the overall sentiment as one of: positive, neutral, or negative.

Guidelines:
- "positive": Expresses satisfaction, enthusiasm, praise, or constructive feedback
- "neutral": Factual statements, questions, or mixed feelings without clear positive/negative bias
- "negative": Criticism, frustration, complaints, or warnings without constructive intent

Respond with ONLY a JSON object in this exact format:
{
  "label": "positive" | "neutral" | "negative",
  "score": <number between -1.0 (most negative) and 1.0 (most positive)>,
  "summary": "<brief 1-sentence explanation of why this sentiment was chosen>"
}`;
};

export const SYSTEM_INSTRUCTION = `You are a sentiment analysis expert specializing in developer tools and coding agent feedback. 
Provide accurate, consistent sentiment classifications based on the content's overall tone and intent.
Always respond with valid JSON containing label, score, and summary fields.`;

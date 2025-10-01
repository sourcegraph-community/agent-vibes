import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';
import { z } from 'npm:zod';

const requestSchema = z
  .object({
    batchSize: z.number().int().min(1).max(25).optional(),
    modelVersion: z.string().min(1).optional(),
    maxRetries: z.number().int().min(0).max(5).optional(),
  })
  .default({});

const envSchema = z.object({
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be set for Edge Function.' }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, { message: 'SUPABASE_SERVICE_ROLE_KEY must be set for Edge Function.' }),
  GEMINI_API_KEY: z.string().min(1, { message: 'GEMINI_API_KEY is required for sentiment processing.' }),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),
});

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface TweetRow {
  id: string;
  raw_tweet_id: string | null;
  run_id: string | null;
  platform: string;
  platform_id: string;
  revision: number;
  author_handle: string | null;
  author_name: string | null;
  posted_at: string | null;
  collected_at: string | null;
  language: string | null;
  content: string;
  url: string | null;
  engagement_likes: number | null;
  engagement_retweets: number | null;
  keyword_snapshot: string[] | null;
  model_context: Record<string, unknown> | null;
}

interface SentimentSuccess {
  success: true;
  label: 'positive' | 'neutral' | 'negative';
  score: number;
  summary: string | null;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

interface SentimentFailure {
  success: false;
  retryable: boolean;
  latencyMs: number;
  code: string;
  message: string;
}

type SentimentResult = SentimentSuccess | SentimentFailure;

const parseEnvironment = () => {
  const env = envSchema.parse({
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    GEMINI_API_KEY: Deno.env.get('GEMINI_API_KEY'),
    GEMINI_MODEL: Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash',
  });

  return {
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL,
  };
};

const fetchPendingTweets = async (supabase: ReturnType<typeof createClient>, limit: number) => {
  const { data, error } = await supabase
    .from('normalized_tweets')
    .select(
      `id, raw_tweet_id, run_id, platform, platform_id, revision, author_handle, author_name, posted_at, collected_at, language, content, url, engagement_likes, engagement_retweets, keyword_snapshot, model_context`,
    )
    .eq('status', 'pending_sentiment')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch pending tweets: ${error.message}`);
  }

  return (data ?? []) as TweetRow[];
};

const insertSentiment = async (
  supabase: ReturnType<typeof createClient>,
  tweetId: string,
  modelVersion: string,
  result: SentimentSuccess,
) => {
  const { error } = await supabase.from('tweet_sentiments').insert({
    normalized_tweet_id: tweetId,
    model_version: modelVersion,
    sentiment_label: result.label,
    sentiment_score: result.score,
    reasoning: result.summary ? { summary: result.summary } : null,
    latency_ms: result.latencyMs,
  });

  if (error) {
    throw new Error(`Failed to insert sentiment: ${error.message}`);
  }
};

const insertFailure = async (
  supabase: ReturnType<typeof createClient>,
  tweetId: string,
  modelVersion: string,
  failure: SentimentFailure,
  retryCount: number,
) => {
  const { error } = await supabase.from('sentiment_failures').insert({
    normalized_tweet_id: tweetId,
    model_version: modelVersion,
    failure_stage: 'gemini_api_call',
    error_code: failure.code,
    error_message: failure.message,
    retry_count: retryCount,
    payload: null,
  });

  if (error) {
    throw new Error(`Failed to record sentiment failure: ${error.message}`);
  }
};

const updateTweetStatus = async (
  supabase: ReturnType<typeof createClient>,
  tweet: TweetRow,
  status: 'processed' | 'failed',
) => {
  const { error } = await supabase.from('normalized_tweets').insert({
    raw_tweet_id: tweet.raw_tweet_id,
    run_id: tweet.run_id,
    platform: tweet.platform,
    platform_id: tweet.platform_id,
    revision: tweet.revision + 1,
    author_handle: tweet.author_handle,
    author_name: tweet.author_name,
    posted_at: tweet.posted_at,
    collected_at: tweet.collected_at,
    language: tweet.language,
    content: tweet.content,
    url: tweet.url,
    engagement_likes: tweet.engagement_likes,
    engagement_retweets: tweet.engagement_retweets,
    keyword_snapshot: tweet.keyword_snapshot,
    status,
    status_changed_at: new Date().toISOString(),
    model_context: tweet.model_context,
  });

  if (error) {
    throw new Error(`Failed to insert tweet revision: ${error.message}`);
  }
};

const getRetryCount = async (
  supabase: ReturnType<typeof createClient>,
  tweetId: string,
): Promise<number> => {
  const { data, error } = await supabase
    .from('sentiment_failures')
    .select('retry_count')
    .eq('normalized_tweet_id', tweetId)
    .order('last_attempt_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return 0;
  }

  return data.retry_count ?? 0;
};

const callGemini = async (
  apiKey: string,
  model: string,
  content: string,
  authorHandle: string | null,
  language: string | null,
): Promise<SentimentResult> => {
  const promptPayload = {
    contents: [
      {
        parts: [
          {
            text: buildPrompt(content, authorHandle, language),
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

  const response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`, {
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
  } catch (error) {
    return {
      success: false,
      retryable: false,
      latencyMs,
      code: 'PARSE_ERROR',
      message: error instanceof Error ? error.message : 'Failed to parse response',
    };
  }
};

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

const SYSTEM_INSTRUCTION = `You are a sentiment analysis system for social media posts about coding agents.
Return structured JSON with fields:\n{ "label": "positive|neutral|negative", "score": number between -1 and 1, "summary": short string }.
Keep answers deterministic and avoid additional text.`;

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

serve(async (request: Request) => {
  try {
    const env = parseEnvironment();
    const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const payload = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const input = requestSchema.parse(payload);

    const batchSize = input.batchSize ?? 10;
    const modelVersion = input.modelVersion ?? env.geminiModel;
    const maxRetries = input.maxRetries ?? 2;

    const tweets = await fetchPendingTweets(supabase, batchSize);

    if (tweets.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No pending tweets', stats: { processed: 0, failed: 0, skipped: 0 } }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    let totalLatencyMs = 0;
    let totalTokens = 0;

    for (const tweet of tweets) {
      const result = await callGemini(env.geminiApiKey, modelVersion, tweet.content, tweet.author_handle, tweet.language);

      totalLatencyMs += result.latencyMs;

      if (result.success) {
        if (result.totalTokens) {
          totalTokens += result.totalTokens;
        }

        await insertSentiment(supabase, tweet.id, modelVersion, result);
        await updateTweetStatus(supabase, tweet, 'processed');
        processed += 1;
      } else {
        const retryCount = (await getRetryCount(supabase, tweet.id)) + 1;
        await insertFailure(supabase, tweet.id, modelVersion, result, retryCount);

        if (!result.retryable || retryCount >= maxRetries) {
          await updateTweetStatus(supabase, tweet, 'failed');
          failed += 1;
        } else {
          skipped += 1;
        }
      }

      // Respect Gemini rate limits (15 RPM => ~4s between calls)
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }

    return new Response(
      JSON.stringify({
        success: failed === 0,
        message: `Processed ${processed} tweets, ${failed} failed, ${skipped} deferred`,
        stats: {
          processed,
          failed,
          skipped,
          totalLatencyMs,
          totalTokens,
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Sentiment processor failed', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
});

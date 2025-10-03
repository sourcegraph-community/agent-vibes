import type { ProcessSentimentsCommandInput, ProcessingStats } from '../types.ts';
import type { SupabaseTweetRepository } from '../infrastructure/supabaseTweetRepository.ts';
import type { GeminiSentimentAnalyzer } from '../core/GeminiSentimentAnalyzer.ts';

export interface ProcessSentimentsDependencies {
  repository: SupabaseTweetRepository;
  analyzer: GeminiSentimentAnalyzer;
  defaults: {
    batchSize: number;
    modelVersion: string;
    maxRetries: number;
    rateLimitDelayMs: number;
  };
}

export interface ProcessSentimentsResult {
  success: boolean;
  message: string;
  stats: ProcessingStats;
}

export const handleProcessSentiments = async (
  command: ProcessSentimentsCommandInput,
  dependencies: ProcessSentimentsDependencies,
): Promise<ProcessSentimentsResult> => {
  const batchSize = command.batchSize ?? dependencies.defaults.batchSize;
  const modelVersion = command.modelVersion ?? dependencies.defaults.modelVersion;
  const maxRetries = command.maxRetries ?? dependencies.defaults.maxRetries;
  const rateLimitDelayMs = dependencies.defaults.rateLimitDelayMs;

  const stats: ProcessingStats = {
    processed: 0,
    failed: 0,
    skipped: 0,
    totalLatencyMs: 0,
    totalTokens: 0,
  };

  while (true) {
    const tweets = await dependencies.repository.fetchPendingTweets(batchSize);
    if (tweets.length === 0) {
      break;
    }

    for (let index = 0; index < tweets.length; index++) {
      const tweet = tweets[index];
      const result = await dependencies.analyzer.analyze({
        content: tweet.content,
        authorHandle: tweet.authorHandle,
        language: tweet.language,
      });

      stats.totalLatencyMs += result.latencyMs;

      if (result.success) {
        if (result.totalTokens) {
          stats.totalTokens += result.totalTokens;
        }

        await dependencies.repository.insertSentiment({
          tweetId: tweet.id,
          modelVersion,
          label: result.label,
          score: result.score,
          summary: result.summary,
          latencyMs: result.latencyMs,
        });

        await dependencies.repository.updateTweetStatus(tweet, 'processed');
        stats.processed += 1;
      } else {
        const retryCount = (await dependencies.repository.getRetryCount(tweet.id)) + 1;

        await dependencies.repository.recordFailure({
          tweetId: tweet.id,
          modelVersion,
          failureStage: 'gemini_api_call',
          errorCode: result.code,
          errorMessage: result.message,
          retryCount,
          payload: null,
        });

        if (!result.retryable || retryCount >= maxRetries) {
          await dependencies.repository.updateTweetStatus(tweet, 'failed');
          stats.failed += 1;
        } else {
          stats.skipped += 1;
        }
      }

      if (index < tweets.length - 1 && rateLimitDelayMs > 0) {
        await delay(rateLimitDelayMs);
      }
    }
  }

  return {
    success: stats.failed === 0,
    message: `Processed ${stats.processed} tweets, ${stats.failed} failed, ${stats.skipped} deferred`,
    stats,
  } satisfies ProcessSentimentsResult;
};

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

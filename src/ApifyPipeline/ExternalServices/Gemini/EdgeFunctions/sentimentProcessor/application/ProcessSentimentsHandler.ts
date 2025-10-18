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
    // New: concurrency & rate limits
    concurrency: number;
    rpmCap?: number;
    tpmCap?: number;
    tokensPerRequestEstimate: number;
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

  const concurrency = Math.max(1, Math.min(1000, dependencies.defaults.concurrency));
  const rpmCap = dependencies.defaults.rpmCap && dependencies.defaults.rpmCap > 0 ? dependencies.defaults.rpmCap : undefined;
  const tpmCap = dependencies.defaults.tpmCap && dependencies.defaults.tpmCap > 0 ? dependencies.defaults.tpmCap : undefined;
  const tokensPerReqEst = Math.max(1, dependencies.defaults.tokensPerRequestEstimate);

  const stats: ProcessingStats = {
    processed: 0,
    failed: 0,
    skipped: 0,
    totalLatencyMs: 0,
    totalTokens: 0,
  };

  // Rolling-window limiter state
  const requestTimestamps: number[] = [];
  let usedTokensThisWindow = 0;
  let windowStart = Date.now();

  const acquirePermit = async (): Promise<void> => {
    while (true) {
      const now = Date.now();
      // Reset window every 60s
      if (now - windowStart >= 60000) {
        windowStart = now;
        usedTokensThisWindow = 0;
        while (requestTimestamps.length && now - requestTimestamps[0] >= 60000) {
          requestTimestamps.shift();
        }
      }

      while (requestTimestamps.length && now - requestTimestamps[0] >= 60000) {
        requestTimestamps.shift();
      }

      const rpmAvailable = rpmCap ? requestTimestamps.length < rpmCap : true;
      const tpmAvailable = tpmCap ? (usedTokensThisWindow + tokensPerReqEst) <= tpmCap : true;

      if (rpmAvailable && tpmAvailable) {
        requestTimestamps.push(now);
        usedTokensThisWindow += tokensPerReqEst;
        return;
      }

      const waitMs = requestTimestamps.length
        ? Math.max(50, 60000 - (now - requestTimestamps[0]))
        : 1000;
      await delay(waitMs);
    }
  };

  while (true) {
    const tweets = await dependencies.repository.fetchPendingTweets(batchSize);
    if (tweets.length === 0) break;

    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const index = nextIndex;
        if (index >= tweets.length) return;
        nextIndex += 1;

        const tweet = tweets[index];

        try {
          // Rate limiting
          if (rpmCap || tpmCap) {
            await acquirePermit();
          }

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

          // Only use fixed delay if rpmCap not set
          if (!rpmCap && rateLimitDelayMs > 0) {
            await delay(rateLimitDelayMs);
          }
        }
        catch (error) {
          const retryCount = (await dependencies.repository.getRetryCount(tweet.id)) + 1;
          await dependencies.repository.recordFailure({
            tweetId: tweet.id,
            modelVersion,
            failureStage: 'unexpected_error',
            errorCode: 'PROCESSOR_ERROR',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            retryCount,
            payload: null,
          });
          await dependencies.repository.updateTweetStatus(tweet, 'failed');
          stats.failed += 1;
        }
      }
    };

    const pool = Array.from({ length: concurrency }, () => worker());
    await Promise.all(pool);
  }

  return {
    success: stats.failed === 0,
    message: `Processed ${stats.processed} tweets, ${stats.failed} failed, ${stats.skipped} deferred`,
    stats,
  } satisfies ProcessSentimentsResult;
};

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

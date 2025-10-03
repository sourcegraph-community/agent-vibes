import type { GeminiClient } from '../../ExternalServices/Gemini/GeminiClient';
import type { TweetSentimentsRepository } from '../../DataAccess/Repositories/TweetSentimentsRepository';

export interface ProcessingStats {
  processed: number;
  failed: number;
  skipped: number;
  totalLatencyMs: number;
  totalTokens: number;
}

export interface SentimentProcessorConfig {
  modelVersion: string;
  batchSize: number;
  maxRetries: number;
  rateLimitDelayMs?: number;
  concurrency?: number;
  rpmCap?: number;
  tpmCap?: number;
  tokensPerRequestEstimate?: number;
}

export class SentimentProcessor {
  constructor(
    private readonly geminiClient: GeminiClient,
    private readonly repository: TweetSentimentsRepository,
    private readonly config: SentimentProcessorConfig,
  ) {}

  async processPendingTweets(): Promise<ProcessingStats> {
    const stats: ProcessingStats = {
      processed: 0,
      failed: 0,
      skipped: 0,
      totalLatencyMs: 0,
      totalTokens: 0,
    };

    const pendingTweets = await this.repository.getPendingSentiments(this.config.batchSize);

    if (pendingTweets.length === 0) {
      return stats;
    }

    // Concurrency + rolling-window RPM limiter
    const concurrency = Math.max(1, Math.min(1000, this.config.concurrency ?? 1));
    const rpmCap = Math.max(1, this.config.rpmCap ?? 15);
    const tpmCap = this.config.tpmCap && this.config.tpmCap > 0 ? this.config.tpmCap : undefined;
    const tokensPerReqEst = Math.max(1, this.config.tokensPerRequestEstimate ?? 600);

    let nextIndex = 0;
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
          // prune timestamps
          while (requestTimestamps.length && now - requestTimestamps[0] >= 60000) {
            requestTimestamps.shift();
          }
        }

        // Prune old timestamps for rolling-minute check
        while (requestTimestamps.length && now - requestTimestamps[0] >= 60000) {
          requestTimestamps.shift();
        }

        const rpmAvailable = requestTimestamps.length < rpmCap;
        const tpmAvailable = tpmCap ? (usedTokensThisWindow + tokensPerReqEst) <= tpmCap : true;

        if (rpmAvailable && tpmAvailable) {
          requestTimestamps.push(now);
          usedTokensThisWindow += tokensPerReqEst;
          return;
        }

        const waitMs = requestTimestamps.length
          ? Math.max(50, 60000 - (now - requestTimestamps[0]))
          : 1000;
        await new Promise((r) => setTimeout(r, waitMs));
      }
    };

    const worker = async (): Promise<void> => {
      while (true) {
        const index = nextIndex;
        if (index >= pendingTweets.length) return;
        nextIndex += 1;

        const tweet = pendingTweets[index];

        try {
          await acquirePermit();

          const result = await this.geminiClient.analyzeSentiment({
            tweetId: tweet.id,
            content: tweet.content,
            authorHandle: tweet.authorHandle,
            language: tweet.language,
          });

          stats.totalLatencyMs += result.latencyMs;
          if (result.tokenUsage && typeof result.tokenUsage.total === 'number') {
            stats.totalTokens += result.tokenUsage.total;
          }

          if (result.success && result.sentiment) {
            await this.repository.insertSentiment({
              normalizedTweetId: tweet.id,
              modelVersion: this.config.modelVersion,
              sentimentLabel: result.sentiment.label,
              sentimentScore: result.sentiment.score,
              reasoning: result.sentiment.summary ? { summary: result.sentiment.summary } : null,
              latencyMs: result.latencyMs,
            });
            await this.repository.updateTweetStatus(tweet.id, 'processed');
            stats.processed += 1;
            console.log(
              `[Sentiment] OK [${index + 1}/${pendingTweets.length}] id=${tweet.id} label=${result.sentiment.label} score=${result.sentiment.score.toFixed(2)} latencyMs=${result.latencyMs} tokens=${result.tokenUsage?.total ?? '-'} `,
            );
          } else if (result.error) {
            const currentRetryCount = await this.repository.getRetryCountForTweet(tweet.id);
            const newRetryCount = currentRetryCount + 1;
            await this.repository.recordFailure({
              normalizedTweetId: tweet.id,
              modelVersion: this.config.modelVersion,
              failureStage: 'gemini_api_call',
              errorCode: result.error.code,
              errorMessage: result.error.message,
              retryCount: newRetryCount,
              payload: { content: tweet.content.substring(0, 500) },
            });
            if (!result.error.retryable || newRetryCount >= this.config.maxRetries) {
              await this.repository.updateTweetStatus(tweet.id, 'failed');
            }
            stats.failed += 1;
            console.warn(
              `[Sentiment] FAIL [${index + 1}/${pendingTweets.length}] id=${tweet.id} code=${result.error.code} msg=${result.error.message.slice(0, 120)}`,
            );
          }
        } catch (error) {
          const currentRetryCount = await this.repository.getRetryCountForTweet(tweet.id);
          const newRetryCount = currentRetryCount + 1;
          await this.repository.recordFailure({
            normalizedTweetId: tweet.id,
            modelVersion: this.config.modelVersion,
            failureStage: 'unexpected_error',
            errorCode: 'PROCESSOR_ERROR',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            retryCount: newRetryCount,
            payload: null,
          });
          await this.repository.updateTweetStatus(tweet.id, 'failed');
          stats.failed += 1;
        }
      }
    };

    const pool = Array.from({ length: concurrency }, () => worker());
    await Promise.all(pool);

    return stats;
  }

  async replayFailedSentiment(tweetId: string): Promise<boolean> {
    const tweet = await this.repository.getTweetById(tweetId);

    if (!tweet) {
      return false;
    }

    const result = await this.geminiClient.analyzeSentiment({
      tweetId: tweet.id,
      content: tweet.content,
      authorHandle: tweet.authorHandle,
      language: tweet.language,
    });

    if (result.success && result.sentiment) {
      await this.repository.insertSentiment({
        normalizedTweetId: tweet.id,
        modelVersion: this.config.modelVersion,
        sentimentLabel: result.sentiment.label,
        sentimentScore: result.sentiment.score,
        reasoning: result.sentiment.summary
          ? { summary: result.sentiment.summary }
          : null,
        latencyMs: result.latencyMs,
      });

      await this.repository.updateTweetStatus(tweet.id, 'processed');
      return true;
    }

    if (result.error) {
      const currentRetryCount = await this.repository.getRetryCountForTweet(tweet.id);
      const newRetryCount = currentRetryCount + 1;

      await this.repository.recordFailure({
        normalizedTweetId: tweet.id,
        modelVersion: this.config.modelVersion,
        failureStage: 'replay_attempt',
        errorCode: result.error.code,
        errorMessage: result.error.message,
        retryCount: newRetryCount,
        payload: null,
      });
    }

    return false;
  }
}

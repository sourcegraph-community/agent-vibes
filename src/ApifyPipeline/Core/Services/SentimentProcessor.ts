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

    for (let i = 0; i < pendingTweets.length; i++) {
      const tweet = pendingTweets[i];

      try {
        const result = await this.geminiClient.analyzeSentiment({
          tweetId: tweet.id,
          content: tweet.content,
          authorHandle: tweet.authorHandle,
          language: tweet.language,
        });

        stats.totalLatencyMs += result.latencyMs;

        if (result.tokenUsage) {
          stats.totalTokens += result.tokenUsage.total;
        }

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
          stats.processed++;
        }
        else if (result.error) {
          // Get current retry count for this specific tweet
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

          // Mark as failed if not retryable or exceeded max retries for this tweet
          if (!result.error.retryable || newRetryCount >= this.config.maxRetries) {
            await this.repository.updateTweetStatus(tweet.id, 'failed');
          }

          stats.failed++;
        }
      }
      catch (error) {
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
        stats.failed++;
      }

      // Rate limit delay between requests (except after last tweet)
      if (i < pendingTweets.length - 1 && this.config.rateLimitDelayMs) {
        await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelayMs));
      }
    }

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

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

    for (const tweet of pendingTweets) {
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
          await this.repository.recordFailure({
            normalizedTweetId: tweet.id,
            modelVersion: this.config.modelVersion,
            failureStage: 'gemini_api_call',
            errorCode: result.error.code,
            errorMessage: result.error.message,
            retryCount: 0,
            payload: { content: tweet.content.substring(0, 500) },
          });

          if (!result.error.retryable || stats.failed >= this.config.maxRetries) {
            await this.repository.updateTweetStatus(tweet.id, 'failed');
          }

          stats.failed++;
        }
      }
      catch (error) {
        await this.repository.recordFailure({
          normalizedTweetId: tweet.id,
          modelVersion: this.config.modelVersion,
          failureStage: 'unexpected_error',
          errorCode: 'PROCESSOR_ERROR',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          retryCount: 0,
          payload: null,
        });

        await this.repository.updateTweetStatus(tweet.id, 'failed');
        stats.failed++;
      }
    }

    return stats;
  }

  async replayFailedSentiment(tweetId: string): Promise<boolean> {
    const tweets = await this.repository.getPendingSentiments(1000);
    const tweet = tweets.find(t => t.id === tweetId);

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
      await this.repository.recordFailure({
        normalizedTweetId: tweet.id,
        modelVersion: this.config.modelVersion,
        failureStage: 'replay_attempt',
        errorCode: result.error.code,
        errorMessage: result.error.message,
        retryCount: 1,
        payload: null,
      });
    }

    return false;
  }
}

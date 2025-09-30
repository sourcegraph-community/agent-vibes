import { describe, it, expect } from 'vitest';
import {
  normalizeTweet,
  extractPlatformId,
  type ApifyTweetItem,
  type NormalizationContext,
} from '@/src/ApifyPipeline/Core/Transformations/normalizeTweet';

describe('extractPlatformId', () => {
  it('should extract platform ID from id field', () => {
    const item: ApifyTweetItem = { id: '123456789' };
    expect(extractPlatformId(item)).toBe('123456789');
  });

  it('should extract platform ID from id_str field', () => {
    const item: ApifyTweetItem = { id_str: '987654321' };
    expect(extractPlatformId(item)).toBe('987654321');
  });

  it('should extract platform ID from tweetId field', () => {
    const item: ApifyTweetItem = { tweetId: '111222333' };
    expect(extractPlatformId(item)).toBe('111222333');
  });

  it('should extract platform ID from tweet_id field', () => {
    const item: ApifyTweetItem = { tweet_id: '444555666' };
    expect(extractPlatformId(item)).toBe('444555666');
  });

  it('should prioritize id over other fields', () => {
    const item: ApifyTweetItem = {
      id: '123',
      id_str: '456',
      tweetId: '789',
    };
    expect(extractPlatformId(item)).toBe('123');
  });

  it('should throw error when all ID fields are missing', () => {
    const item: ApifyTweetItem = {};
    expect(() => extractPlatformId(item)).toThrow(
      'Tweet item is missing a platform identifier.',
    );
  });

  it('should throw error when ID fields are null/undefined', () => {
    const item: ApifyTweetItem = {
      id: undefined,
    };
    expect(() => extractPlatformId(item)).toThrow(
      'Tweet item is missing a platform identifier.',
    );
  });
});

describe('normalizeTweet', () => {
  const baseContext: NormalizationContext = {
    runId: 'run-123',
    rawTweetId: 'raw-456',
    collectedAt: '2025-09-30T10:00:00Z',
    keywords: ['bitcoin', 'crypto'],
  };

  describe('basic transformation', () => {
    it('should normalize tweet with all fields present', () => {
      const item: ApifyTweetItem = {
        id: '123456789',
        full_text: 'This is a test tweet about bitcoin',
        lang: 'en',
        created_at: '2025-09-30T09:00:00Z',
        url: 'https://twitter.com/user/status/123456789',
        user: {
          username: 'testuser',
          name: 'Test User',
        },
        public_metrics: {
          like_count: 10,
          retweet_count: 5,
        },
        matchedKeywords: ['bitcoin'],
      };

      const result = normalizeTweet(item, baseContext);

      expect(result).toMatchObject({
        rawTweetId: 'raw-456',
        runId: 'run-123',
        platform: 'twitter',
        platformId: '123456789',
        revision: 1,
        authorHandle: 'testuser',
        authorName: 'Test User',
        language: 'en',
        content: 'This is a test tweet about bitcoin',
        url: 'https://twitter.com/user/status/123456789',
        engagementLikes: 10,
        engagementRetweets: 5,
        status: 'pending_sentiment',
      });
      expect(result.keywordSnapshot).toContain('bitcoin');
      expect(result.keywordSnapshot).toContain('crypto');
    });

    it('should normalize tweet with minimal fields', () => {
      const item: ApifyTweetItem = {
        id: '999',
        text: 'Minimal tweet',
      };

      const result = normalizeTweet(item, baseContext);

      expect(result.platformId).toBe('999');
      expect(result.content).toBe('Minimal tweet');
      expect(result.platform).toBe('twitter');
      expect(result.revision).toBe(1);
      expect(result.status).toBe('pending_sentiment');
    });
  });

  describe('content field variations', () => {
    it('should extract content from full_text field', () => {
      const item: ApifyTweetItem = {
        id: '1',
        full_text: 'Content from full_text',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.content).toBe('Content from full_text');
    });

    it('should extract content from fullText field', () => {
      const item: ApifyTweetItem = {
        id: '1',
        fullText: 'Content from fullText',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.content).toBe('Content from fullText');
    });

    it('should extract content from text field', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Content from text',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.content).toBe('Content from text');
    });

    it('should prioritize full_text over fullText and text', () => {
      const item: ApifyTweetItem = {
        id: '1',
        full_text: 'Priority content',
        fullText: 'Secondary content',
        text: 'Fallback content',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.content).toBe('Priority content');
    });

    it('should throw error when content is missing', () => {
      const item: ApifyTweetItem = { id: '1' };
      expect(() => normalizeTweet(item, baseContext)).toThrow(
        'Tweet item is missing text content.',
      );
    });
  });

  describe('author field variations', () => {
    it('should extract author from author.username', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        author: { username: 'author_username' },
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.authorHandle).toBe('author_username');
    });

    it('should extract author from user.username', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        user: { username: 'user_username' },
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.authorHandle).toBe('user_username');
    });

    it('should extract author from user.screen_name', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        user: { screen_name: 'screen_name' },
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.authorHandle).toBe('screen_name');
    });

    it('should handle missing author gracefully', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.authorHandle).toBeNull();
      expect(result.authorName).toBeNull();
    });

    it('should extract author name from various fields', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        user: { name: 'John Doe' },
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.authorName).toBe('John Doe');
    });
  });

  describe('URL construction', () => {
    it('should use direct URL when provided', () => {
      const item: ApifyTweetItem = {
        id: '123',
        text: 'Test',
        url: 'https://twitter.com/direct/status/123',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.url).toBe('https://twitter.com/direct/status/123');
    });

    it('should construct URL from platform ID and author handle', () => {
      const item: ApifyTweetItem = {
        id: '456',
        text: 'Test',
        user: { username: 'testuser' },
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.url).toBe('https://twitter.com/testuser/status/456');
    });

    it('should return null when URL cannot be determined', () => {
      const item: ApifyTweetItem = {
        id: '789',
        text: 'Test',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.url).toBeNull();
    });
  });

  describe('engagement metrics', () => {
    it('should extract likes from public_metrics', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        public_metrics: { like_count: 100 },
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.engagementLikes).toBe(100);
    });

    it('should extract likes from metrics.likeCount', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        metrics: { likeCount: 200 },
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.engagementLikes).toBe(200);
    });

    it('should extract likes from favoriteCount', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        favoriteCount: 300,
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.engagementLikes).toBe(300);
    });

    it('should extract retweets from various fields', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        public_metrics: { retweet_count: 50 },
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.engagementRetweets).toBe(50);
    });

    it('should handle missing engagement metrics', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.engagementLikes).toBeNull();
      expect(result.engagementRetweets).toBeNull();
    });
  });

  describe('keyword aggregation', () => {
    it('should include keywords from context', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.keywordSnapshot).toContain('bitcoin');
      expect(result.keywordSnapshot).toContain('crypto');
    });

    it('should aggregate keywords from matchedKeywords', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        matchedKeywords: ['ethereum', 'defi'],
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.keywordSnapshot).toContain('ethereum');
      expect(result.keywordSnapshot).toContain('defi');
    });

    it('should aggregate keywords from matchedQueries', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        matchedQueries: ['nft'],
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.keywordSnapshot).toContain('nft');
    });

    it('should aggregate keywords from searchTerms', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        searchTerms: ['blockchain'],
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.keywordSnapshot).toContain('blockchain');
    });

    it('should deduplicate keywords and normalize to lowercase', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        matchedKeywords: ['Bitcoin', 'CRYPTO'],
      };
      const context: NormalizationContext = {
        ...baseContext,
        keywords: ['bitcoin', 'ethereum'],
      };
      const result = normalizeTweet(item, context);
      expect(result.keywordSnapshot).toContain('bitcoin');
      expect(result.keywordSnapshot).toContain('crypto');
      expect(result.keywordSnapshot).toContain('ethereum');
      expect(result.keywordSnapshot.filter(k => k === 'bitcoin').length).toBe(1);
    });

    it('should handle empty keyword arrays', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        matchedKeywords: [],
      };
      const context: NormalizationContext = {
        ...baseContext,
        keywords: [],
      };
      const result = normalizeTweet(item, context);
      expect(result.keywordSnapshot).toEqual([]);
    });
  });

  describe('language field variations', () => {
    it('should extract language from lang field', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        lang: 'es',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.language).toBe('es');
    });

    it('should extract language from language field', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        language: 'fr',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.language).toBe('fr');
    });

    it('should handle missing language', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.language).toBeNull();
    });
  });

  describe('timestamp handling', () => {
    it('should parse created_at timestamp', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        created_at: '2025-09-30T12:00:00Z',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.postedAt).toBe('2025-09-30T12:00:00.000Z');
    });

    it('should parse createdAt timestamp', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        createdAt: '2025-09-29T08:30:00Z',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.postedAt).toBe('2025-09-29T08:30:00.000Z');
    });

    it('should use current time as fallback for invalid date', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
        created_at: 'invalid-date',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should use current time when timestamp is missing', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('metadata and status', () => {
    it('should set correct metadata', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.platform).toBe('twitter');
      expect(result.revision).toBe(1);
      expect(result.status).toBe('pending_sentiment');
      expect(result.collectedAt).toBe(baseContext.collectedAt);
      expect(result.statusChangedAt).toBe(baseContext.collectedAt);
      expect(result.modelContext).toEqual({
        collector: 'apify-actor',
      });
    });

    it('should link to context IDs', () => {
      const item: ApifyTweetItem = {
        id: '1',
        text: 'Test',
      };
      const result = normalizeTweet(item, baseContext);
      expect(result.rawTweetId).toBe('raw-456');
      expect(result.runId).toBe('run-123');
    });
  });
});

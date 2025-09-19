import { ApifyClient } from 'apify-client';
import { BaseSourceHandler } from './base';
import type { EntryDraft } from '@/types/sources';

export class ApifySourceHandler extends BaseSourceHandler {
  private client: ApifyClient;
  private actorId: string;
  private runInput: Record<string, any>;

  constructor(
    endpoint: string,
    keywords: string[] = [],
    actorId: string,
    runInput: Record<string, any> = {},
  ) {
    super(endpoint, keywords);

    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN environment variable is required');
    }

    this.client = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });

    this.actorId = actorId;
    this.runInput = runInput;
  }

  async fetchLatest(lastPublished?: Date): Promise<EntryDraft[]> {
    try {
      console.log(`🕷️ Starting Apify scraper: ${this.actorId}`);

      // Run the actor
      const run = await this.client.actor(this.actorId).call(this.runInput);

      if (!run || !run.id) {
        throw new Error('Failed to start Apify actor run');
      }

      // Wait for completion (with timeout)
      const finishedRun = await this.client.run(run.id).waitForFinish({
        waitSecs: 120, // 2 minute timeout
      });

      if (finishedRun.status !== 'SUCCEEDED') {
        throw new Error(`Actor run failed with status: ${finishedRun.status}`);
      }

      // Get the dataset items
      const { items } = await this.client.dataset(finishedRun.defaultDatasetId).listItems();

      const entries: EntryDraft[] = [];

      for (const item of items) {
        try {
          const entry = this.transformApifyItem(item, lastPublished);
          if (entry) {
            entries.push(entry);
          }
        } catch (error) {
          console.warn(`Failed to transform item:`, error);
        }
      }

      return entries.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    } catch (error) {
      console.error(`Apify scraping failed for ${this.actorId}:`, error);
      throw new Error(`Failed to fetch from Apify: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected transformApifyItem(item: any, lastPublished?: Date): EntryDraft | null {
    // This method should be overridden by specific implementations
    // Default transformation assumes common fields

    const title = item.title || item.name || item.text || 'Untitled';
    const url = item.url || item.link || item.href;

    if (!title || !url) {
      return null;
    }

    // Try to parse publication date
    let publishedAt: Date;
    const dateFields = ['publishedAt', 'createdAt', 'date', 'timestamp'];
    const dateValue = dateFields.find(field => item[field])
      ? item[dateFields.find(field => item[field])!]
      : null;

    try {
      publishedAt = dateValue ? new Date(dateValue) : new Date();
    } catch {
      publishedAt = new Date();
    }

    // Skip if older than lastPublished
    if (lastPublished && publishedAt <= lastPublished) {
      return null;
    }

    // Check keyword matching
    const textToMatch = `${title} ${item.description || item.content || item.text || ''}`;
    if (!this.matchesKeywords(textToMatch)) {
      return null;
    }

    return {
      title,
      url,
      slug: this.generateSlug(title),
      publishedAt,
      summary: this.truncateText(
        item.description || item.content || item.text || title,
        300,
      ),
      content: item.content || item.text || '',
      tags: item.tags || [],
    };
  }
}

// Specific implementations for different use cases

export class RedditApifyHandler extends ApifySourceHandler {
  constructor(subreddit: string, keywords: string[] = []) {
    const runInput = {
      subreddit,
      maxItems: 50,
      sort: 'new',
    };

    super(
      `https://www.reddit.com/r/${subreddit}`,
      keywords,
      'trudax/reddit-scraper', // Popular Reddit scraper actor
      runInput,
    );
  }

  protected transformApifyItem(item: any, lastPublished?: Date): EntryDraft | null {
    if (!item.title || !item.url) return null;

    let publishedAt: Date;
    try {
      publishedAt = new Date(item.created * 1000); // Reddit timestamp is in seconds
    } catch {
      publishedAt = new Date();
    }

    if (lastPublished && publishedAt <= lastPublished) return null;

    const textToMatch = `${item.title} ${item.selftext || ''}`;
    if (!this.matchesKeywords(textToMatch)) return null;

    return {
      title: item.title,
      url: item.url,
      slug: this.generateSlug(item.title),
      publishedAt,
      summary: this.truncateText(item.selftext || item.title, 300),
      content: item.selftext || '',
      tags: item.link_flair_text ? [item.link_flair_text] : [],
    };
  }
}

export class WebScrapingApifyHandler extends ApifySourceHandler {
  constructor(url: string, keywords: string[] = [], selector?: string) {
    const runInput = {
      startUrls: [{ url }],
      linkSelector: 'a',
      pageFunction: selector ? `
        return {
          title: document.querySelector('${selector} h1, h2, h3')?.textContent,
          content: document.querySelector('${selector}')?.textContent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        };
      ` : undefined,
    };

    super(
      url,
      keywords,
      'apify/web-scraper', // Generic web scraper
      runInput,
    );
  }
}

// Factory function to create appropriate handlers
export function createApifyHandler(
  type: 'reddit' | 'web-scraping' | 'custom',
  config: any,
): ApifySourceHandler {
  switch (type) {
    case 'reddit':
      return new RedditApifyHandler(config.subreddit, config.keywords);

    case 'web-scraping':
      return new WebScrapingApifyHandler(config.url, config.keywords, config.selector);

    case 'custom':
      return new ApifySourceHandler(
        config.endpoint,
        config.keywords,
        config.actorId,
        config.runInput,
      );

    default:
      throw new Error(`Unknown Apify handler type: ${type}`);
  }
}

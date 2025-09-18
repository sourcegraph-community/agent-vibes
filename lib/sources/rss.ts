import Parser from 'rss-parser';
import { BaseSourceHandler } from './base';
import type { EntryDraft } from '@/types/sources';

export class RSSSourceHandler extends BaseSourceHandler {
  private parser: Parser;

  constructor(endpoint: string, keywords: string[] = []) {
    super(endpoint, keywords);
    this.parser = new Parser({
      customFields: {
        item: ['author', 'creator', 'category', 'categories'],
      },
    });
  }

  async fetchLatest(lastPublished?: Date): Promise<EntryDraft[]> {
    try {
      const feed = await this.parser.parseURL(this.endpoint);

      if (!feed.items) {
        return [];
      }

      const entries: EntryDraft[] = [];

      for (const item of feed.items) {
        if (!item.title || !item.link) continue;

        // Parse publication date
        let publishedAt: Date;
        try {
          publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
        } catch {
          publishedAt = new Date();
        }

        // Skip if older than lastPublished
        if (lastPublished && publishedAt <= lastPublished) {
          continue;
        }

        // Check keyword matching
        const textToMatch = `${item.title} ${item.contentSnippet || item.content || ''}`;
        if (!this.matchesKeywords(textToMatch)) {
          continue;
        }

        // Extract content and summary
        const content = item.content || item.contentSnippet || '';
        const summary = this.truncateText(
          item.contentSnippet || item.content || item.title,
          300,
        );

        // Extract tags/categories
        let tags: string[] = [];
        if (item.categories) {
          tags = Array.isArray(item.categories) ? item.categories : [item.categories];
        }
        if (item.category && !tags.includes(item.category)) {
          tags.push(item.category);
        }

        const entry: EntryDraft = {
          title: item.title,
          url: item.link,
          slug: this.generateSlug(item.title),
          publishedAt,
          summary,
          content,
          tags,
        };

        entries.push(entry);
      }

      // Sort by publication date (newest first)
      return entries.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    } catch (error) {
      console.error(`RSS fetch failed for ${this.endpoint}:`, error);
      throw new Error(`Failed to fetch RSS feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const feed = await this.parser.parseURL(this.endpoint);
      return Boolean(feed.items && feed.items.length > 0);
    } catch {
      return false;
    }
  }
}

import { BaseSourceHandler } from './base';
import type { EntryDraft } from '@/types/sources';

interface HNSearchResult {
  hits: HNHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}

interface HNHit {
  objectID: string;
  title: string;
  url: string;
  author: string;
  created_at: string;
  created_at_i: number;
  points: number;
  num_comments: number;
  story_text?: string;
  comment_text?: string;
  story_title?: string;
  story_url?: string;
  tags: string[];
}

export class HackerNewsSourceHandler extends BaseSourceHandler {
  private baseUrl = 'https://hn.algolia.com/api/v1/search_by_date';

  constructor(keywords: string[] = []) {
    super('https://news.ycombinator.com', keywords);
  }

  async fetchLatest(lastPublished?: Date): Promise<EntryDraft[]> {
    try {
      // Build search query with keywords
      const query = this.keywords.length > 0 ? this.keywords.join(' OR ') : 'AI coding assistant copilot cursor windsurf';

      // Calculate timestamp for lastPublished
      const numericFilters = lastPublished
        ? `created_at_i>${Math.floor(lastPublished.getTime() / 1000)}`
        : '';

      const params = new URLSearchParams({
        query,
        tags: 'story', // Only get stories, not comments
        hitsPerPage: '50',
        numericFilters,
      });

      const url = `${this.baseUrl}?${params.toString()}`;
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`HN API error: ${response.status} ${response.statusText}`);
      }

      const data: HNSearchResult = await response.json();

      if (!data.hits) {
        return [];
      }

      const entries: EntryDraft[] = [];

      for (const hit of data.hits) {
        try {
          const entry = this.transformHNHit(hit);
          if (entry) {
            entries.push(entry);
          }
        } catch (error) {
          console.warn(`Failed to transform HN hit ${hit.objectID}:`, error);
        }
      }

      return entries.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    } catch (error) {
      console.error('Hacker News fetch failed:', error);
      throw new Error(`Failed to fetch from Hacker News: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private transformHNHit(hit: HNHit): EntryDraft | null {
    if (!hit.title) {
      return null;
    }

    // Use the story URL if available, otherwise construct HN URL
    const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;

    // Parse creation timestamp
    const publishedAt = new Date(hit.created_at_i * 1000);

    // Check keyword matching on title and content
    const textToMatch = `${hit.title} ${hit.story_text || ''}`;
    if (!this.matchesKeywords(textToMatch)) {
      return null;
    }

    // Create summary from story text or title
    let summary = hit.story_text || hit.title;
    if (summary.length > 300) {
      summary = this.truncateText(summary, 300);
    }

    // Create tags from HN metadata
    const tags: string[] = [];
    if (hit.points > 50) tags.push('popular');
    if (hit.num_comments > 10) tags.push('discussed');
    if (hit.tags.includes('show_hn')) tags.push('Show HN');
    if (hit.tags.includes('ask_hn')) tags.push('Ask HN');

    return {
      title: hit.title,
      url,
      slug: this.generateSlug(hit.title),
      publishedAt,
      summary,
      content: hit.story_text || '',
      tags,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        query: 'test',
        hitsPerPage: '1',
      });

      const response = await this.fetchWithTimeout(`${this.baseUrl}?${params.toString()}`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

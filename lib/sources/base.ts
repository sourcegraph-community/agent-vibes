import type { SourceHandler, EntryDraft } from '@/types/sources';

export abstract class BaseSourceHandler implements SourceHandler {
  protected endpoint: string;
  protected keywords: string[] = [];

  constructor(endpoint: string, keywords: string[] = []) {
    this.endpoint = endpoint;
    this.keywords = keywords;
  }

  abstract fetchLatest(lastPublished?: Date): Promise<EntryDraft[]>;

  getEntryId(draft: EntryDraft): string {
    return draft.url;
  }

  protected async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'AgentVibes/1.0 (+https://agentvibes.com)',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  protected matchesKeywords(text: string): boolean {
    if (this.keywords.length === 0) return true;

    const lowercaseText = text.toLowerCase();
    return this.keywords.some(keyword =>
      lowercaseText.includes(keyword.toLowerCase()),
    );
  }

  protected generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  protected truncateText(text: string, maxLength: number = 500): string {
    if (text.length <= maxLength) return text;

    const truncated = text.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');

    if (lastSentence > maxLength * 0.7) {
      return truncated.substring(0, lastSentence + 1);
    }

    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? `${truncated.substring(0, lastSpace)}...` : `${truncated}...`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(this.endpoint, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
}

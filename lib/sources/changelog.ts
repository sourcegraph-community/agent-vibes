import { JSDOM } from 'jsdom';
import { BaseSourceHandler } from './base';
import type { EntryDraft } from '@/types/sources';

export class MarkdownChangelogHandler extends BaseSourceHandler {
  constructor(endpoint: string, keywords: string[] = []) {
    super(endpoint, keywords);
  }

  async fetchLatest(lastPublished?: Date): Promise<EntryDraft[]> {
    try {
      const response = await this.fetchWithTimeout(this.endpoint);

      if (!response.ok) {
        throw new Error(`Failed to fetch changelog: ${response.status} ${response.statusText}`);
      }

      const markdown = await response.text();
      return this.parseMarkdownChangelog(markdown, lastPublished);

    } catch (error) {
      console.error(`Markdown changelog fetch failed for ${this.endpoint}:`, error);
      throw new Error(`Failed to fetch markdown changelog: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseMarkdownChangelog(markdown: string, lastPublished?: Date): EntryDraft[] {
    const entries: EntryDraft[] = [];

    // Split by version headers (## or ###)
    const sections = markdown.split(/^(#{2,3})\s+(.+)$/gm);

    for (let i = 1; i < sections.length; i += 3) {
      const headerLevel = sections[i];
      const headerText = sections[i + 1];
      const content = sections[i + 2] || '';

      if (!headerText || headerLevel !== '##') continue;

      try {
        const entry = this.parseChangelogSection(headerText, content);
        if (entry && (!lastPublished || entry.publishedAt > lastPublished)) {
          entries.push(entry);
        }
      } catch (error) {
        console.warn(`Failed to parse changelog section "${headerText}":`, error);
      }
    }

    return entries;
  }

  private parseChangelogSection(headerText: string, content: string): EntryDraft | null {
    // Extract version and date from header
    const versionMatch = headerText.match(/(\d+\.\d+\.\d+)/);
    const dateMatch = headerText.match(/(\d{4}-\d{2}-\d{2})/);

    if (!versionMatch) return null;

    const version = versionMatch[1];
    let publishedAt: Date;

    if (dateMatch) {
      publishedAt = new Date(dateMatch[1]);
    } else {
      // If no date in header, try to extract from content or use current date
      const contentDateMatch = content.match(/(\d{4}-\d{2}-\d{2})/);
      publishedAt = contentDateMatch ? new Date(contentDateMatch[1]) : new Date();
    }

    const title = `v${version} Release`;
    const summary = this.extractChangeSummary(content);

    // Check keyword matching
    const textToMatch = `${title} ${summary}`;
    if (!this.matchesKeywords(textToMatch)) {
      return null;
    }

    return {
      title,
      url: `${this.endpoint}#${version.replace(/\./g, '')}`,
      slug: this.generateSlug(title),
      publishedAt,
      summary,
      content: content.trim(),
      tags: this.extractTags(content),
    };
  }

  private extractChangeSummary(content: string): string {
    // Extract first few bullet points or first paragraph
    const lines = content.split('\n').filter(line => line.trim());
    const summaryLines: string[] = [];

    for (const line of lines) {
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        summaryLines.push(line.trim().substring(2));
        if (summaryLines.length >= 3) break;
      }
    }

    if (summaryLines.length === 0) {
      // Fallback to first paragraph
      const firstParagraph = lines.find(line => line.trim().length > 0);
      return firstParagraph ? this.truncateText(firstParagraph, 200) : 'Release notes available';
    }

    return summaryLines.join('; ');
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const lowerContent = content.toLowerCase();

    // Common changelog categories
    if (lowerContent.includes('breaking')) tags.push('breaking-change');
    if (lowerContent.includes('fix') || lowerContent.includes('bug')) tags.push('bugfix');
    if (lowerContent.includes('feature') || lowerContent.includes('new')) tags.push('feature');
    if (lowerContent.includes('improve') || lowerContent.includes('enhance')) tags.push('improvement');
    if (lowerContent.includes('security')) tags.push('security');
    if (lowerContent.includes('performance')) tags.push('performance');

    return tags;
  }
}

export class HTMLChangelogHandler extends BaseSourceHandler {
  constructor(endpoint: string, keywords: string[] = []) {
    super(endpoint, keywords);
  }

  async fetchLatest(lastPublished?: Date): Promise<EntryDraft[]> {
    try {
      const response = await this.fetchWithTimeout(this.endpoint);

      if (!response.ok) {
        throw new Error(`Failed to fetch changelog: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseHTMLChangelog(html, lastPublished);

    } catch (error) {
      console.error(`HTML changelog fetch failed for ${this.endpoint}:`, error);
      throw new Error(`Failed to fetch HTML changelog: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseHTMLChangelog(html: string, lastPublished?: Date): EntryDraft[] {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const entries: EntryDraft[] = [];

    // Common changelog selectors
    const selectors = [
      '[class*="changelog"] > div',
      '[class*="release"] > div',
      'article',
      '[data-testid*="changelog"]',
      '.version-item',
      '.release-item',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        for (const element of elements) {
          try {
            const entry = this.parseHTMLEntry(element as Element);
            if (entry && (!lastPublished || entry.publishedAt > lastPublished)) {
              entries.push(entry);
            }
          } catch (error) {
            console.warn('Failed to parse HTML entry:', error);
          }
        }
        break; // Use first successful selector
      }
    }

    return entries.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }

  private parseHTMLEntry(element: Element): EntryDraft | null {
    const titleElement = element.querySelector('h1, h2, h3, h4, .title, [class*="title"]');
    const dateElement = element.querySelector('[class*="date"], time, .timestamp');
    const contentElement = element.querySelector('.content, .description, p') || element;

    if (!titleElement) return null;

    const title = titleElement.textContent?.trim() || 'Untitled';
    const content = contentElement.textContent?.trim() || '';

    // Parse date
    let publishedAt: Date;
    if (dateElement) {
      const dateText = dateElement.getAttribute('datetime') || dateElement.textContent || '';
      publishedAt = new Date(dateText);
      if (isNaN(publishedAt.getTime())) {
        publishedAt = new Date();
      }
    } else {
      // Try to extract date from title or content
      const dateMatch = (title + ' ' + content).match(/(\d{4}-\d{2}-\d{2})/);
      publishedAt = dateMatch ? new Date(dateMatch[1]) : new Date();
    }

    // Check keyword matching
    const textToMatch = `${title} ${content}`;
    if (!this.matchesKeywords(textToMatch)) {
      return null;
    }

    return {
      title,
      url: this.endpoint,
      slug: this.generateSlug(title),
      publishedAt,
      summary: this.truncateText(content, 300),
      content,
      tags: this.extractTagsFromHTML(element),
    };
  }

  private extractTagsFromHTML(element: Element): string[] {
    const tags: string[] = [];
    const classList = Array.from(element.classList);

    // Extract meaningful tags from classes
    for (const className of classList) {
      if (className.includes('feature')) tags.push('feature');
      if (className.includes('fix')) tags.push('bugfix');
      if (className.includes('breaking')) tags.push('breaking-change');
      if (className.includes('security')) tags.push('security');
    }

    return tags;
  }
}

// Factory function for creating changelog handlers
export function createChangelogHandler(url: string, keywords: string[] = []) {
  if (url.includes('raw.githubusercontent.com') || url.endsWith('.md')) {
    return new MarkdownChangelogHandler(url, keywords);
  } else {
    return new HTMLChangelogHandler(url, keywords);
  }
}

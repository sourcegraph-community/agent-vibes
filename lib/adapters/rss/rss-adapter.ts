import Parser from 'rss-parser';
import { promises as fs } from 'fs';
import { join } from 'path';
import type {
  UnifiedEntry,
  UnifiedEntryBatch,
  RSSMetadata,
  SourceType,
  CategoryType,
} from '@/contracts/unified-entry';
import {
  generateEntryId,
  truncateSummary,
  isValidUnifiedEntry,
  createUnifiedEntry,
} from '@/contracts/unified-entry';
import { getActiveRSSConfigs } from '@/lib/sources/config';

/**
 * RSS Adapter - Stateless RSS feed processor for AgentVibes
 *
 * Converts RSS feeds to UnifiedEntry format and outputs JSON files
 * following the oracle's specification for data pipeline integration.
 */
export class RSSAdapter {
  private parser: Parser;
  private readonly timeout: number = 15000; // 15 second timeout
  private readonly maxRetries: number = 3;

  constructor() {
    this.parser = new Parser({
      timeout: this.timeout,
      headers: {
        'User-Agent': 'AgentVibes RSS Adapter/1.0 (+https://agentvibes.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      customFields: {
        feed: ['author', 'creator'],
        item: ['author', 'creator', 'category', 'categories', 'dc:creator'],
      },
    });
  }

  /**
   * Main adapter entry point - processes all active RSS sources
   */
  async processAll(): Promise<UnifiedEntryBatch> {
    const startTime = Date.now();
    const fetchedAt = new Date().toISOString();
    const errors: string[] = [];
    const totalEntries: UnifiedEntry[] = [];

    console.log('🔄 Starting RSS adapter processing...');

    const rssConfigs = getActiveRSSConfigs();
    console.log(`📰 Found ${rssConfigs.length} active RSS sources`);

    // Process sources with controlled concurrency (max 5 simultaneous)
    const batchSize = 5;
    for (let i = 0; i < rssConfigs.length; i += batchSize) {
      const batch = rssConfigs.slice(i, i + batchSize);
      const batchPromises = batch.map(async (config) => {
        try {
          const entries = await this.processSingleSource(config);
          console.log(`✅ ${config.name}: ${entries.length} entries`);
          return entries;
        } catch (error) {
          const errorMsg = `${config.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      totalEntries.push(...batchResults.flat());
    }

    // Sort by publication date (newest first)
    totalEntries.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

    const batch: UnifiedEntryBatch = {
      entries: totalEntries,
      source: 'rss',
      fetchedAt,
      totalCount: totalEntries.length,
      newCount: totalEntries.length, // All are "new" in stateless mode
      errors: errors.length > 0 ? errors : undefined,
    };

    // Output to JSON file
    await this.writeToFile(batch, fetchedAt);

    const durationMs = Date.now() - startTime;
    console.log(`🎉 RSS adapter completed: ${totalEntries.length} entries in ${durationMs}ms`);

    return batch;
  }

  /**
   * Process a single RSS source with retry logic
   */
  private async processSingleSource(config: any): Promise<UnifiedEntry[]> {
    const keywords = config.keywords || [];
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const feed = await this.parser.parseURL(config.endpoint);
        return this.convertFeedToEntries(feed, config, keywords);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.warn(`⚠️  ${config.name} attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Convert RSS feed to UnifiedEntry array
   */
  private convertFeedToEntries(feed: any, config: any, keywords: string[]): UnifiedEntry[] {
    if (!feed.items || !Array.isArray(feed.items)) {
      return [];
    }

    const entries: UnifiedEntry[] = [];
    const feedMetadata = this.extractFeedMetadata(feed);

    for (const item of feed.items) {
      if (!item.title || !item.link) continue;

      try {
        // Check keyword matching if keywords exist
        if (keywords.length > 0) {
          const textToMatch = `${item.title} ${item.contentSnippet || item.content || ''}`;
          if (!this.matchesKeywords(textToMatch, keywords)) {
            continue;
          }
        }

        const entry = this.convertItemToEntry(item, config, feedMetadata);
        if (entry && isValidUnifiedEntry(entry)) {
          entries.push(entry);
        }
      } catch (error) {
        console.warn(`⚠️  Failed to process item "${item.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return entries;
  }

  /**
   * Convert RSS item to UnifiedEntry
   */
  private convertItemToEntry(item: any, config: any, feedMetadata: RSSMetadata): UnifiedEntry {
    // Generate consistent ID
    const id = generateEntryId(item.link, item.title);

    // Parse publication date with fallbacks
    let publishedAt: string;
    try {
      if (item.pubDate) {
        publishedAt = new Date(item.pubDate).toISOString();
      } else if (item.isoDate) {
        publishedAt = new Date(item.isoDate).toISOString();
      } else {
        publishedAt = new Date().toISOString();
      }
    } catch {
      publishedAt = new Date().toISOString();
    }

    // Extract content and create summary
    const content = item.content || item.contentSnippet || '';
    const summary = truncateSummary(
      item.contentSnippet || item.summary || content || item.title,
    );

    // Extract tags from RSS categories
    const tags: string[] = [];
    if (item.categories && Array.isArray(item.categories)) {
      tags.push(...item.categories.filter((cat: any) => typeof cat === 'string'));
    } else if (item.category && typeof item.category === 'string') {
      tags.push(item.category);
    }

    // Add source-specific keywords as tags
    if (config.keywords && Array.isArray(config.keywords)) {
      const matchingKeywords = config.keywords.filter((keyword: string) =>
        this.matchesKeywords(content + ' ' + item.title, [keyword]),
      );
      tags.push(...matchingKeywords);
    }

    // Determine category based on source and content
    const category = this.determineCategoryFromSource(config.name, tags, content);

    // Create RSS-specific metadata
    const metadata: RSSMetadata = {
      feedTitle: feedMetadata.feedTitle,
      author: item.creator || item.author || feedMetadata.author,
      categories: tags.length > 0 ? tags : undefined,
    };

    return createUnifiedEntry({
      id,
      title: item.title,
      summary,
      url: item.link,
      publishedAt,
      source: 'rss' as SourceType,
      category,
      content: content || undefined,
      tags: tags.length > 0 ? [...new Set(tags)] : undefined, // Deduplicate
      metadata,
    });
  }

  /**
   * Extract metadata from RSS feed
   */
  private extractFeedMetadata(feed: any): RSSMetadata {
    return {
      feedTitle: feed.title || undefined,
      author: feed.author || feed.creator || feed.managingEditor || undefined,
    };
  }

  /**
   * Determine category based on source name and content analysis
   */
  private determineCategoryFromSource(sourceName: string, tags: string[], content: string): CategoryType {
    const lowerSourceName = sourceName.toLowerCase();
    const lowerContent = (content + ' ' + tags.join(' ')).toLowerCase();

    // Product announcements and releases
    if (lowerSourceName.includes('changelog') ||
        lowerSourceName.includes('release') ||
        lowerContent.includes('release') ||
        lowerContent.includes('version') ||
        lowerContent.includes('feature') ||
        lowerContent.includes('update')) {
      return 'product';
    }

    // Research papers and academic content
    if (lowerSourceName.includes('paper') ||
        lowerSourceName.includes('research') ||
        lowerSourceName.includes('arxiv') ||
        lowerContent.includes('paper') ||
        lowerContent.includes('research') ||
        lowerContent.includes('study')) {
      return 'research';
    }

    // Social/community content
    if (lowerSourceName.includes('reddit') ||
        lowerSourceName.includes('hacker') ||
        lowerSourceName.includes('discussion') ||
        lowerContent.includes('community') ||
        lowerContent.includes('discussion')) {
      return 'social';
    }

    // Default to perspective for blogs, news, analysis
    return 'perspective';
  }

  /**
   * Check if text matches any of the keywords
   */
  private matchesKeywords(text: string, keywords: string[]): boolean {
    if (keywords.length === 0) return true;

    const lowerText = text.toLowerCase();
    return keywords.some(keyword =>
      lowerText.includes(keyword.toLowerCase()),
    );
  }

  /**
   * Write batch to JSON file with date-based naming
   */
  private async writeToFile(batch: UnifiedEntryBatch, fetchedAt: string): Promise<void> {
    const date = new Date(fetchedAt).toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `rss-${date}.json`;
    const outputDir = join(process.cwd(), '.next', 'cache');
    const filepath = join(outputDir, filename);

    try {
      // Ensure cache directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Write JSON file with proper formatting
      const jsonContent = JSON.stringify(batch, null, 2);
      await fs.writeFile(filepath, jsonContent, 'utf-8');

      console.log(`📄 Written ${batch.entries.length} entries to ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to write output file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}

/**
 * Standalone function for npm script execution
 */
export async function runRSSAdapter(): Promise<void> {
  try {
    const adapter = new RSSAdapter();
    const batch = await adapter.processAll();

    // Summary report
    console.log('\n📊 RSS Adapter Summary:');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📰 Total entries: ${batch.totalCount}`);
    console.log(`📅 Fetched at: ${batch.fetchedAt}`);

    if (batch.errors && batch.errors.length > 0) {
      console.log(`❌ Errors: ${batch.errors.length}`);
      batch.errors.forEach(error => console.log(`   • ${error}`));
    }

    // Show sample sources configured
    const rssConfigs = getActiveRSSConfigs();
    console.log(`\n🎯 RSS Sources (${rssConfigs.length} active):`);
    rssConfigs.slice(0, 5).forEach(config => {
      const matchingEntries = batch.entries.filter(entry =>
        entry.metadata && (entry.metadata as RSSMetadata).feedTitle?.includes(config.name.split(' ')[0]),
      ).length;
      console.log(`   • ${config.name}: ${matchingEntries || '?'} entries`);
    });

    if (rssConfigs.length > 5) {
      console.log(`   • ... and ${rssConfigs.length - 5} more`);
    }

    console.log(`\n✅ RSS adapter completed successfully!`);

  } catch (error) {
    console.error('❌ RSS adapter failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Enable direct script execution
if (require.main === module) {
  runRSSAdapter();
}

/**
 * Unified Entry Contract
 *
 * This interface defines the standard data structure for all entries
 * across different data sources in the AgentVibes system.
 *
 * Matches Prisma schema fields and is compatible with both Node.js/TypeScript
 * and Python scripts for cross-platform data processing.
 */

export interface UnifiedEntry {
  /** Unique identifier for the entry (typically URL or hash-based) */
  id: string;

  /** Entry title/headline */
  title: string;

  /** Brief summary/excerpt (max ~300 chars) */
  summary: string;

  /** Source URL for the entry */
  url: string;

  /** ISO-UTC timestamp of when the entry was published */
  publishedAt: string;

  /** Source identifier - where this entry came from */
  source: SourceType;

  /** Content category for dashboard organization */
  category: CategoryType;

  /** Optional sentiment score (-1 to 1, where -1=negative, 0=neutral, 1=positive) */
  sentiment?: number;

  /** Optional full content (if available) */
  content?: string;

  /** Optional tags/keywords array */
  tags?: string[];

  /** Optional metadata specific to source type */
  metadata?: Record<string, any>;
}

/**
 * Source type identifiers
 */
export type SourceType =
  | 'rss'           // RSS feed entries
  | 'github_pr'     // GitHub pull requests
  | 'github_issue'  // GitHub issues
  | 'ads_build'     // ADS API research papers
  | 'hackernews'    // Hacker News stories
  | 'reddit'        // Reddit posts
  | 'scrape'        // Web scraped content
  | 'api'           // Generic API responses
  | 'manual';       // Manually added entries

/**
 * Content categories for dashboard organization
 */
export type CategoryType =
  | 'product'       // Product announcements, releases, features
  | 'research'      // Academic papers, research findings
  | 'perspective'   // Blog posts, opinions, analysis
  | 'social';       // Community discussions, social media

/**
 * Source metadata interfaces for type safety
 */
export interface RSSMetadata {
  feedTitle?: string;
  author?: string;
  categories?: string[];
}

export interface GitHubMetadata {
  repository?: string;
  author?: string;
  prNumber?: number;
  issueNumber?: number;
  labels?: string[];
}

export interface ADSMetadata {
  arxivClass?: string;
  authors?: string;
  citations?: number;
  arxivId?: string;
}

export interface HackerNewsMetadata {
  points?: number;
  comments?: number;
  author?: string;
}

export interface RedditMetadata {
  subreddit?: string;
  author?: string;
  upvotes?: number;
  comments?: number;
}

/**
 * Helper type for entries with source-specific metadata
 */
export type TypedUnifiedEntry<T extends SourceType> = UnifiedEntry & {
  source: T;
  metadata?: T extends 'rss' ? RSSMetadata
    : T extends 'github_pr' | 'github_issue' ? GitHubMetadata
      : T extends 'ads_build' ? ADSMetadata
        : T extends 'hackernews' ? HackerNewsMetadata
          : T extends 'reddit' ? RedditMetadata
            : Record<string, any>;
};

/**
 * Batch processing interface for data adapters
 */
export interface UnifiedEntryBatch {
  entries: UnifiedEntry[];
  source: SourceType;
  fetchedAt: string;
  totalCount: number;
  newCount: number;
  errors?: string[];
}

/**
 * Utility functions for working with UnifiedEntry
 */

/**
 * Validate that an object conforms to UnifiedEntry interface
 */
export function isValidUnifiedEntry(obj: any): obj is UnifiedEntry {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.summary === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.publishedAt === 'string' &&
    typeof obj.source === 'string' &&
    typeof obj.category === 'string' &&
    (obj.sentiment === undefined || typeof obj.sentiment === 'number')
  );
}

/**
 * Create a UnifiedEntry with defaults
 */
export function createUnifiedEntry(
  partial: Partial<UnifiedEntry> & Pick<UnifiedEntry, 'id' | 'title' | 'url' | 'source'>,
): UnifiedEntry {
  return {
    summary: partial.summary || partial.title || '',
    publishedAt: partial.publishedAt || new Date().toISOString(),
    category: partial.category || 'perspective',
    ...partial,
  };
}

/**
 * Generate a consistent ID for an entry (useful for deduplication)
 */
export function generateEntryId(url: string, title: string = ''): string {
  // Use URL as primary ID, fallback to title hash if needed
  return url || `hash-${Buffer.from(title).toString('base64').slice(0, 16)}`;
}

/**
 * Truncate text for summary field
 */
export function truncateSummary(text: string, maxLength: number = 300): string {
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastSentence = truncated.lastIndexOf('.');

  if (lastSentence > maxLength * 0.7) {
    return truncated.substring(0, lastSentence + 1);
  }

  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? `${truncated.substring(0, lastSpace)}...` : `${truncated}...`;
}

/**
 * Sort entries by publication date (newest first)
 */
export function sortEntriesByDate(entries: UnifiedEntry[]): UnifiedEntry[] {
  return entries.sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

/**
 * Group entries by category
 */
export function groupEntriesByCategory(entries: UnifiedEntry[]): Record<CategoryType, UnifiedEntry[]> {
  return entries.reduce((groups, entry) => {
    if (!groups[entry.category]) {
      groups[entry.category] = [];
    }
    groups[entry.category].push(entry);
    return groups;
  }, {} as Record<CategoryType, UnifiedEntry[]>);
}

/**
 * Python-compatible type definitions (for documentation)
 *
 * When implementing in Python, use these equivalent structures:
 *
 * ```python
 * from typing import Dict, List, Optional, Union, Literal
 * from dataclasses import dataclass
 * from datetime import datetime
 *
 * SourceType = Literal[
 *     "rss", "github_pr", "github_issue", "ads_build",
 *     "hackernews", "reddit", "scrape", "api", "manual"
 * ]
 *
 * CategoryType = Literal["product", "research", "perspective", "social"]
 *
 * @dataclass
 * class UnifiedEntry:
 *     id: str
 *     title: str
 *     summary: str
 *     url: str
 *     published_at: str  # ISO format
 *     source: SourceType
 *     category: CategoryType
 *     sentiment: Optional[float] = None
 *     content: Optional[str] = None
 *     tags: Optional[List[str]] = None
 *     metadata: Optional[Dict[str, any]] = None
 * ```
 */

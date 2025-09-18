import type { Source, Entry } from '@prisma/client';

export interface EntryDraft {
  title: string;
  url: string;
  slug?: string;
  publishedAt: Date;
  summary?: string;
  content?: string;
  tags?: string[];
}

export interface SourceHandler {
  /**
   * Fetch the latest items since the last published date
   */
  fetchLatest(lastPublished?: Date): Promise<EntryDraft[]>;

  /**
   * Get a permanent, stable ID for deduping (usually the URL or hash)
   */
  getEntryId(draft: EntryDraft): string;

  /**
   * Optional: validate that the source is accessible
   */
  healthCheck?(): Promise<boolean>;
}

export interface SourceConfig {
  name: string;
  type: 'RSS' | 'API' | 'SCRAPE';
  endpoint: string;
  keywords?: string[];
  isActive?: boolean;
}

export type SourceWithEntries = Source & {
  entries: Entry[];
};

export interface CrawlResult {
  sourceId: string;
  newEntries: EntryDraft[];
  status: 'SUCCESS' | 'ERROR' | 'PARTIAL';
  error?: string;
  durationMs: number;
}

export type RssEntryStatus = 'pending_summary' | 'processing_summary' | 'summarized' | 'failed';
export type RssCategory = 'product_updates' | 'industry_research' | 'perspectives' | 'uncategorized';

export interface RssEntry {
  id: string;
  feedId: string;
  feedTitle: string | null;
  entryId: string;
  title: string;
  url: string;
  author: string | null;
  publishedAt: string;
  content: string | null;
  summary: string | null;
  category: RssCategory;
  status: RssEntryStatus;
  statusChangedAt: string;
  collectedAt: string;
  createdAt: string;
}

export interface RssSummary {
  id: string;
  entryId: string;
  modelVersion: string;
  summaryText: string;
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  topics: string[];
  processedAt: string;
  latencyMs: number | null;
  createdAt: string;
}

export interface RssCategoryCount {
  category: RssCategory;
  count: number;
}

export interface RssEntryWithSummary extends RssEntry {
  generatedSummary: RssSummary | null;
}

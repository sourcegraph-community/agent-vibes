import type { RssCategory } from './RssEntry';

export const RSS_CATEGORIES: readonly RssCategory[] = [
  'product_updates',
  'industry_research',
  'perspectives',
  'uncategorized',
] as const;

export const RSS_CATEGORY_LABELS: Record<RssCategory, string> = {
  product_updates: 'Product Updates',
  industry_research: 'Industry Research',
  perspectives: 'Perspectives',
  uncategorized: 'Uncategorized',
};

export const RSS_CATEGORY_DESCRIPTIONS: Record<RssCategory, string> = {
  product_updates: 'Updates about product features, releases, and announcements',
  industry_research: 'Research, trends, and insights about the industry',
  perspectives: 'Opinion pieces, thought leadership, and commentary',
  uncategorized: 'Entries that do not fit other categories',
};

export const isValidCategory = (value: unknown): value is RssCategory => {
  return typeof value === 'string' && RSS_CATEGORIES.includes(value as RssCategory);
};

import type { KeywordTrendRow } from '../../Models/Tweets';
import type { SupabaseQuery } from './queryBuilder';

export interface KeywordTrendFilters {
  startDate?: string;
  endDate?: string;
  keywords?: string[];
  limit?: number;
}

export const buildKeywordTrendQuery = (
  filters: KeywordTrendFilters = {},
): SupabaseQuery => {
  const query: SupabaseQuery = {
    from: 'vw_keyword_trends',
    select:
      'sentiment_day, keyword, mention_count, negative_count, avg_sentiment_score',
    filters: [],
    orderBy: [
      { column: 'sentiment_day', ascending: false },
      { column: 'keyword', ascending: true },
    ],
  };

  if (filters.startDate) {
    query.filters.push({ column: 'sentiment_day', operator: 'gte', value: filters.startDate });
  }

  if (filters.endDate) {
    query.filters.push({ column: 'sentiment_day', operator: 'lte', value: filters.endDate });
  }

  if (filters.keywords && filters.keywords.length > 0) {
    const normalized = filters.keywords.map((keyword) => keyword.toLowerCase());
    query.filters.push({ column: 'keyword', operator: 'in', value: normalized });
  }

  if (typeof filters.limit === 'number') {
    query.limit = filters.limit;
  }

  return query;
};

export type KeywordTrendResult = KeywordTrendRow[];

import type { DailySentimentRow } from '../../Models/Tweets';
import type { SupabaseQuery } from './queryBuilder';

export interface DailySentimentFilters {
  startDate?: string;
  endDate?: string;
  languages?: string[];
  limit?: number;
}

export const buildDailySentimentQuery = (
  filters: DailySentimentFilters = {},
): SupabaseQuery => {
  const query: SupabaseQuery = {
    from: 'vw_daily_sentiment',
    select:
      'sentiment_day, language, positive_count, neutral_count, negative_count, total_count, avg_sentiment_score',
    filters: [],
    orderBy: [
      { column: 'sentiment_day', ascending: false },
      { column: 'language', ascending: true },
    ],
  };

  if (filters.startDate) {
    query.filters.push({ column: 'sentiment_day', operator: 'gte', value: filters.startDate });
  }

  if (filters.endDate) {
    query.filters.push({ column: 'sentiment_day', operator: 'lte', value: filters.endDate });
  }

  if (filters.languages && filters.languages.length > 0) {
    query.filters.push({ column: 'language', operator: 'in', value: filters.languages });
  }

  if (typeof filters.limit === 'number') {
    query.limit = filters.limit;
  }

  return query;
};

export type DailySentimentResult = DailySentimentRow[];

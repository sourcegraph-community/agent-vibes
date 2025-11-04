import { createSupabaseServerClient } from '@/src/ApifyPipeline/Infrastructure/Config/supabase';
import { DashboardRepository } from '@/src/ApifyPipeline/DataAccess/Repositories/DashboardRepository';
import { RssRepository } from '@/src/RssPipeline/DataAccess/Repositories/RssRepository';
import type { RssCategory } from '@/src/RssPipeline/Core/Models/RssEntry';

export interface GetOverviewMetricsQuery {
  days: number;
  // Future extensions: brand?: string; language?: string;
}

export interface GetOverviewMetricsResponse {
  periodDays: number;
  overallSentiment: {
    positivePercentage: number;
    deltaPercentage: number; // vs previous window
  };
  contentAnalyzed: {
    total: number;
    tweets: number;
    rss: number;
    deltaPercentage: number; // vs previous window
  };
  activeDiscussions: {
    totalTweets: number;
    deltaPercentage: number; // vs previous window
  };
  researchPapers: {
    count: number;
    deltaPercentage: number; // vs previous window
  };
  generatedAt: string;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function calcPercentageDelta(current: number, previous: number): number {
  if (!Number.isFinite(previous) || previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export async function handleGetOverviewMetrics(query: GetOverviewMetricsQuery): Promise<GetOverviewMetricsResponse> {
  const days = Math.min(Math.max(query.days, 1), 365);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - (days - 1));

  const prevStart = new Date(currentStart);
  prevStart.setDate(prevStart.getDate() - days);

  const todayYMD = toYMD(now);
  const currentStartYMD = toYMD(currentStart);
  const prevStartYMD = toYMD(prevStart);

  const supabase = await createSupabaseServerClient();
  const dashboardRepo = new DashboardRepository(supabase);
  const rssRepo = new RssRepository(supabase);

  // Current window sentiment (sum across languages)
  const currentSentimentRows = await dashboardRepo.getDailySentiment({
    startDate: currentStartYMD,
    limit: days * 10,
  });

  const currentTotals = currentSentimentRows.reduce(
    (acc, r) => {
      acc.total += r.totalCount;
      acc.pos += r.positiveCount;
      acc.neu += r.neutralCount;
      acc.neg += r.negativeCount;
      return acc;
    },
    { total: 0, pos: 0, neu: 0, neg: 0 },
  );

  const currentPositivePct = currentTotals.total > 0 ? (currentTotals.pos / currentTotals.total) * 100 : 0;

  // Previous window sentiment
  const prevSentimentRows = await dashboardRepo.getDailySentiment({
    startDate: prevStartYMD,
    endDate: toYMD(new Date(currentStart.getTime() - 24 * 60 * 60 * 1000)),
    limit: days * 10,
  });
  const prevTotals = prevSentimentRows.reduce(
    (acc, r) => {
      acc.total += r.totalCount;
      acc.pos += r.positiveCount;
      acc.neu += r.neutralCount;
      acc.neg += r.negativeCount;
      return acc;
    },
    { total: 0, pos: 0, neu: 0, neg: 0 },
  );
  const prevPositivePct = prevTotals.total > 0 ? (prevTotals.pos / prevTotals.total) * 100 : 0;

  // RSS counts
  const rssSincePrevStart = await rssRepo.countEntriesSince({ startDate: prevStartYMD });
  const rssSinceCurrentStart = await rssRepo.countEntriesSince({ startDate: currentStartYMD });
  const rssPrevWindow = Math.max(0, rssSincePrevStart - rssSinceCurrentStart);
  const rssCurrentWindow = rssSinceCurrentStart;

  // Research (industry_research) counts
  const categoryResearch: RssCategory = 'industry_research' as RssCategory;
  const researchSincePrevStart = await rssRepo.countEntriesSince({ startDate: prevStartYMD, category: categoryResearch });
  const researchSinceCurrentStart = await rssRepo.countEntriesSince({ startDate: currentStartYMD, category: categoryResearch });
  const researchPrevWindow = Math.max(0, researchSincePrevStart - researchSinceCurrentStart);
  const researchCurrent = researchSinceCurrentStart;

  // Content analyzed combines tweets (from sentiment totals) + rss entries
  const contentCurrentTotal = (currentTotals.total || 0) + (rssCurrentWindow || 0);
  const contentPrevTotal = (prevTotals.total || 0) + (rssPrevWindow || 0);

  const response: GetOverviewMetricsResponse = {
    periodDays: days,
    overallSentiment: {
      positivePercentage: Number.isFinite(currentPositivePct) ? Number(currentPositivePct.toFixed(3)) : 0,
      deltaPercentage: Number(
        calcPercentageDelta(currentPositivePct, prevPositivePct).toFixed(3),
      ),
    },
    contentAnalyzed: {
      total: contentCurrentTotal,
      tweets: currentTotals.total,
      rss: rssCurrentWindow,
      deltaPercentage: Number(calcPercentageDelta(contentCurrentTotal, contentPrevTotal).toFixed(3)),
    },
    activeDiscussions: {
      totalTweets: currentTotals.total,
      deltaPercentage: Number(calcPercentageDelta(currentTotals.total, prevTotals.total).toFixed(3)),
    },
    researchPapers: {
      count: researchCurrent,
      deltaPercentage: Number(calcPercentageDelta(researchCurrent, researchPrevWindow).toFixed(3)),
    },
    generatedAt: new Date().toISOString(),
  };

  return response;
}

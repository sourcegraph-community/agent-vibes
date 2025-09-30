import { Suspense } from 'react';
import { createSupabaseServerClient } from '@/src/ApifyPipeline/Infrastructure/Config/supabase';
import { DashboardRepository } from '@/src/ApifyPipeline/DataAccess/Repositories/DashboardRepository';

async function KeywordTrendsTable() {
  const supabase = await createSupabaseServerClient();
  const repo = new DashboardRepository(supabase);

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  const trendData = await repo.getKeywordTrends({
    startDate: last30Days.toISOString().split('T')[0],
    limit: 100,
  });

  const keywordMap = new Map<string, {
    totalMentions: number
    totalNegative: number
    days: number
    avgScore: number
  }>();

  trendData.forEach((row) => {
    const existing = keywordMap.get(row.keyword) || {
      totalMentions: 0,
      totalNegative: 0,
      days: 0,
      avgScore: 0,
    };
    existing.totalMentions += row.mentionCount;
    existing.totalNegative += row.negativeCount;
    existing.days += 1;
    existing.avgScore += row.avgSentimentScore || 0;
    keywordMap.set(row.keyword, existing);
  });

  const aggregatedKeywords = Array.from(keywordMap.entries())
    .map(([keyword, stats]) => ({
      keyword,
      totalMentions: stats.totalMentions,
      totalNegative: stats.totalNegative,
      avgScore: stats.days > 0 ? stats.avgScore / stats.days : 0,
      negativePercentage: stats.totalMentions > 0 ? (stats.totalNegative / stats.totalMentions) * 100 : 0,
    }))
    .sort((a, b) => b.totalMentions - a.totalMentions);

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Keyword Performance (Last 30 Days)</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Keyword
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Total Mentions
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Negative Count
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Negative %
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Avg Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {aggregatedKeywords.map((row) => (
                <tr key={row.keyword}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{row.keyword}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{row.totalMentions}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-red-600">{row.totalNegative}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-600">
                    {row.negativePercentage.toFixed(1)}%
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{row.avgScore.toFixed(3)}</td>
                </tr>
              ))}
              {aggregatedKeywords.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No keyword data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function DailyKeywordTrends() {
  const supabase = await createSupabaseServerClient();
  const repo = new DashboardRepository(supabase);

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const trendData = await repo.getKeywordTrends({
    startDate: last7Days.toISOString().split('T')[0],
    limit: 50,
  });

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Daily Keyword Trends (Last 7 Days)</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Keyword
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Mentions
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Negative
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Avg Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {trendData.map((row, idx) => (
                <tr key={`${row.sentimentDay}-${row.keyword}-${idx}`}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {new Date(row.sentimentDay).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{row.keyword}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{row.mentionCount}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-red-600">{row.negativeCount}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{row.avgSentimentScore?.toFixed(3) ?? 'N/A'}</td>
                </tr>
              ))}
              {trendData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No trend data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-gray-500">Loading...</div>
    </div>
  );
}

export default function KeywordsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Keyword Trends</h2>
        <p className="mt-1 text-sm text-gray-500">
          Track keyword performance and sentiment over time
        </p>
      </div>

      <Suspense fallback={<LoadingState />}>
        <KeywordTrendsTable />
      </Suspense>

      <Suspense fallback={<LoadingState />}>
        <DailyKeywordTrends />
      </Suspense>
    </div>
  );
}

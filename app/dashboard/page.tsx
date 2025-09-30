import { Suspense } from 'react';
import { createSupabaseServerClient } from '@/src/ApifyPipeline/Infrastructure/Config/supabase';
import { DashboardRepository } from '@/src/ApifyPipeline/DataAccess/Repositories/DashboardRepository';

async function DashboardStats() {
  const supabase = await createSupabaseServerClient();
  const repo = new DashboardRepository(supabase);

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const sentimentData = await repo.getDailySentiment({
    startDate: last7Days.toISOString().split('T')[0],
    limit: 7,
  });

  const totalTweets = sentimentData.reduce((sum, day) => sum + day.totalCount, 0);
  const totalPositive = sentimentData.reduce((sum, day) => sum + day.positiveCount, 0);
  const totalNeutral = sentimentData.reduce((sum, day) => sum + day.neutralCount, 0);
  const totalNegative = sentimentData.reduce((sum, day) => sum + day.negativeCount, 0);

  const avgScore = sentimentData.length > 0
    ? sentimentData.reduce((sum, day) => sum + (day.avgSentimentScore || 0), 0) / sentimentData.length
    : 0;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt className="truncate text-sm font-medium text-gray-500">Total Tweets (7d)</dt>
        <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{totalTweets}</dd>
      </div>
      <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt className="truncate text-sm font-medium text-gray-500">Positive</dt>
        <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-600">{totalPositive}</dd>
        <dd className="mt-1 text-sm text-gray-500">{totalTweets > 0 ? `${Math.round((totalPositive / totalTweets) * 100)}%` : '0%'}</dd>
      </div>
      <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt className="truncate text-sm font-medium text-gray-500">Neutral</dt>
        <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-600">{totalNeutral}</dd>
        <dd className="mt-1 text-sm text-gray-500">{totalTweets > 0 ? `${Math.round((totalNeutral / totalTweets) * 100)}%` : '0%'}</dd>
      </div>
      <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt className="truncate text-sm font-medium text-gray-500">Negative</dt>
        <dd className="mt-1 text-3xl font-semibold tracking-tight text-red-600">{totalNegative}</dd>
        <dd className="mt-1 text-sm text-gray-500">{totalTweets > 0 ? `${Math.round((totalNegative / totalTweets) * 100)}%` : '0%'}</dd>
      </div>
      <div className="col-span-full overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt className="truncate text-sm font-medium text-gray-500">Average Sentiment Score</dt>
        <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{avgScore.toFixed(3)}</dd>
        <dd className="mt-1 text-sm text-gray-500">Range: -1 (negative) to +1 (positive)</dd>
      </div>
    </div>
  );
}

async function DailySentimentTable() {
  const supabase = await createSupabaseServerClient();
  const repo = new DashboardRepository(supabase);

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  const sentimentData = await repo.getDailySentiment({
    startDate: last30Days.toISOString().split('T')[0],
    limit: 30,
  });

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Daily Sentiment Breakdown</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Language
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Positive
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Neutral
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Negative
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Total
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Avg Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {sentimentData.map((row, idx) => (
                <tr key={`${row.sentimentDay}-${row.language}-${idx}`}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {new Date(row.sentimentDay).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{row.language}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-green-600">{row.positiveCount}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-600">{row.neutralCount}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-red-600">{row.negativeCount}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">{row.totalCount}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{row.avgSentimentScore?.toFixed(3) ?? 'N/A'}</td>
                </tr>
              ))}
              {sentimentData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    No data available
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

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
        <p className="mt-1 text-sm text-gray-500">
          Sentiment analysis metrics for the last 7 days
        </p>
      </div>

      <Suspense fallback={<LoadingState />}>
        <DashboardStats />
      </Suspense>

      <Suspense fallback={<LoadingState />}>
        <DailySentimentTable />
      </Suspense>
    </div>
  );
}

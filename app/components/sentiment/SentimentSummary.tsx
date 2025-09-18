'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/app/components/ui/Card';
import { Metric } from '@/app/components/ui/Metric';

interface SentimentSummaryProps {
  tool?: string;
  window?: string;
}

interface SentimentData {
  summary: {
    avgSentiment: number;
    positive: number;
    negative: number;
    neutral: number;
    positiveRate: number;
    negativeRate: number;
  };
  total: number;
}

export function SentimentSummary({ tool = 'all', window = '7d' }: SentimentSummaryProps) {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (tool && tool !== 'all') params.append('tool', tool);
        if (window) params.append('window', window);

        const response = await fetch(`/api/metrics/sentiment?${params}`);
        if (!response.ok) throw new Error('Failed to fetch data');

        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [tool, window]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="text-red-600 dark:text-red-400 p-4">
          Error loading sentiment data: {error}
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const getSentimentColor = (score: number) => {
    if (score > 1) return 'text-green-600 dark:text-green-400';
    if (score > 0) return 'text-blue-600 dark:text-blue-400';
    if (score < -1) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getSentimentLabel = (score: number) => {
    if (score > 2) return 'Very Positive';
    if (score > 0.5) return 'Positive';
    if (score > -0.5) return 'Neutral';
    if (score > -2) return 'Negative';
    return 'Very Negative';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Overall Sentiment Index */}
      <Card>
        <Metric
          title="Sentiment Index"
          value={data.summary.avgSentiment.toFixed(2)}
          trend={data.summary.avgSentiment > 0 ? 'up' : data.summary.avgSentiment < 0 ? 'down' : 'neutral'}
          className={getSentimentColor(data.summary.avgSentiment)}
        />
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {getSentimentLabel(data.summary.avgSentiment)}
        </div>
      </Card>

      {/* Positive Ratio */}
      <Card>
        <Metric
          title="Positive Posts"
          value={`${data.summary.positiveRate.toFixed(1)}%`}
          trend="up"
          className="text-green-600 dark:text-green-400"
        />
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {data.summary.positive} of {data.total} posts
        </div>
      </Card>

      {/* Negative Ratio */}
      <Card>
        <Metric
          title="Negative Posts"
          value={`${data.summary.negativeRate.toFixed(1)}%`}
          trend="down"
          className="text-red-600 dark:text-red-400"
        />
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {data.summary.negative} of {data.total} posts
        </div>
      </Card>

      {/* Total Volume */}
      <Card>
        <Metric
          title="Total Posts"
          value={data.total.toString()}
          trend="neutral"
          className="text-blue-600 dark:text-blue-400"
        />
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {window === '24h' ? 'Last 24 hours' :
            window === '7d' ? 'Last 7 days' :
              window === '30d' ? 'Last 30 days' : 'All time'}
        </div>
      </Card>
    </div>
  );
}

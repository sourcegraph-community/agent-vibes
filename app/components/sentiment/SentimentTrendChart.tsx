'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/app/components/ui/Card';

interface TrendPoint {
  date: string;
  avgSentiment: number;
  count: number;
  positive: number;
  negative: number;
}

interface SentimentTrendChartProps {
  tool?: string;
  window?: string;
}

export function SentimentTrendChart({ tool = 'all', window = '7d' }: SentimentTrendChartProps) {
  const [data, setData] = useState<TrendPoint[]>([]);
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
        setData(result.trend || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [tool, window]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getSentimentColor = (score: number) => {
    if (score > 1) return 'bg-green-500';
    if (score > 0) return 'bg-blue-500';
    if (score < -1) return 'bg-red-500';
    return 'bg-gray-400';
  };

  const getBarHeight = (score: number, maxScore: number, minScore: number) => {
    // Normalize to 0-100% for display
    const range = maxScore - minScore || 1;
    const normalized = ((score - minScore) / range) * 80 + 10; // 10-90% range
    return Math.max(5, normalized); // Minimum 5% height
  };

  if (loading) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Sentiment Trend
          </h3>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Sentiment Trend
          </h3>
          <div className="text-red-600 dark:text-red-400">
            Error loading trend data: {error}
          </div>
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Sentiment Trend
          </h3>
          <div className="text-gray-500 dark:text-gray-400 text-center py-12">
            No trend data available for the selected filters
          </div>
        </div>
      </Card>
    );
  }

  const maxScore = Math.max(...data.map(d => d.avgSentiment));
  const minScore = Math.min(...data.map(d => d.avgSentiment));

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Sentiment Trend Over Time
        </h3>

        <div className="h-64">
          <div className="flex items-end justify-between h-full gap-2">
            {data.map((point, index) => (
              <div key={point.date} className="flex flex-col items-center flex-1 group">
                {/* Bar */}
                <div className="relative w-full max-w-12 mb-2">
                  <div
                    className={`w-full rounded-t transition-all duration-200 hover:opacity-80 ${getSentimentColor(point.avgSentiment)}`}
                    style={{
                      height: `${getBarHeight(point.avgSentiment, maxScore, minScore)}%`,
                    }}
                  />

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                    <div>Date: {formatDate(point.date)}</div>
                    <div>Sentiment: {point.avgSentiment.toFixed(2)}</div>
                    <div>Posts: {point.count}</div>
                    <div>+{point.positive} / -{point.negative}</div>
                  </div>
                </div>

                {/* Date label */}
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  {formatDate(point.date)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Very Positive (1+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Positive (0+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-400 rounded"></div>
            <span>Neutral (0)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Negative (-1)</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

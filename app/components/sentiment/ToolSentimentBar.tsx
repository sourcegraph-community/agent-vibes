'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/app/components/ui/Card';

interface ToolComparison {
  tool: string;
  avgSentiment: number;
  count: number;
  positive: number;
  negative: number;
  totalEngagement: number;
}

interface ToolSentimentBarProps {
  window?: string;
}

export function ToolSentimentBar({ window = '7d' }: ToolSentimentBarProps) {
  const [data, setData] = useState<ToolComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (window) params.append('window', window);

        const response = await fetch(`/api/metrics/sentiment?${params}`);
        if (!response.ok) throw new Error('Failed to fetch data');

        const result = await response.json();
        setData(result.toolComparison || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [window]);

  const getSentimentColor = (score: number) => {
    if (score > 1) return 'bg-green-500';
    if (score > 0) return 'bg-blue-500';
    if (score < -1) return 'bg-red-500';
    return 'bg-gray-400';
  };

  const getSentimentTextColor = (score: number) => {
    if (score > 1) return 'text-green-600 dark:text-green-400';
    if (score > 0) return 'text-blue-600 dark:text-blue-400';
    if (score < -1) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getBarWidth = (count: number, maxCount: number) => {
    return maxCount > 0 ? (count / maxCount) * 100 : 0;
  };

  if (loading) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Tool Sentiment Comparison
          </h3>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Tool Sentiment Comparison
          </h3>
          <div className="text-red-600 dark:text-red-400">
            Error loading comparison data: {error}
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
            Tool Sentiment Comparison
          </h3>
          <div className="text-gray-500 dark:text-gray-400 text-center py-8">
            No comparison data available
          </div>
        </div>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
          AI Tool Sentiment Comparison
        </h3>

        <div className="space-y-4">
          {data.map((tool, index) => (
            <div key={tool.tool} className="group">
              {/* Tool header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {tool.tool}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {tool.count} posts
                  </span>
                </div>
                <div className={`font-semibold ${getSentimentTextColor(tool.avgSentiment)}`}>
                  {tool.avgSentiment.toFixed(2)}
                </div>
              </div>

              {/* Sentiment bar */}
              <div className="relative">
                {/* Background bar */}
                <div className="w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  {/* Sentiment colored bar */}
                  <div
                    className={`h-full transition-all duration-300 ${getSentimentColor(tool.avgSentiment)}`}
                    style={{ width: `${getBarWidth(tool.count, maxCount)}%` }}
                  />
                </div>

                {/* Positive/Negative breakdown overlay */}
                <div className="absolute inset-0 flex items-center justify-end pr-2">
                  <span className="text-xs text-white font-medium">
                    +{tool.positive} / -{tool.negative}
                  </span>
                </div>
              </div>

              {/* Engagement info */}
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Engagement: {Math.round(tool.totalEngagement).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Bar width represents post volume. Color and number show average sentiment score (-5 to +5).
          </p>
        </div>
      </div>
    </Card>
  );
}

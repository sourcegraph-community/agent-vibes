'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from './ui';
import { TrendingUp, MessageCircle, ThumbsUp, AlertCircle } from 'lucide-react';

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
  toolComparison: Array<{
    tool: string;
    avgSentiment: number;
    count: number;
  }>;
}

export function SentimentDashboardPreview() {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch('/api/metrics/sentiment?window=7d');
        if (!response.ok) throw new Error('Failed to fetch sentiment data');
        
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sentiment data');
        console.error('Error loading sentiment data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

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

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="animate-pulse p-6">
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="md:col-span-2 lg:col-span-4">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>Unable to load sentiment data: {error}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="md:col-span-2 lg:col-span-4">
          <CardContent className="p-6 text-center">
            <div className="text-gray-500 dark:text-gray-400">
              No sentiment data available. Run <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">npm run sentiment</code> to process X posts data.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const topTools = data.toolComparison.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Overall Sentiment */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className={`w-5 h-5 ${getSentimentColor(data.summary.avgSentiment)}`} />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Overall Sentiment
              </span>
            </div>
            <div className={`text-3xl font-bold ${getSentimentColor(data.summary.avgSentiment)}`}>
              {data.summary.avgSentiment.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {getSentimentLabel(data.summary.avgSentiment)}
            </div>
          </CardContent>
        </Card>

        {/* Total Posts */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <MessageCircle className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Posts
              </span>
            </div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {data.total}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Last 7 days
            </div>
          </CardContent>
        </Card>

        {/* Positive Rate */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <ThumbsUp className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Positive Rate
              </span>
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {data.summary.positiveRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {data.summary.positive} positive posts
            </div>
          </CardContent>
        </Card>

        {/* Top Tool */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Top Tool
              </span>
            </div>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {topTools[0]?.tool || 'N/A'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {topTools[0] ? `${topTools[0].avgSentiment.toFixed(2)} avg sentiment` : 'No data'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tool Comparison */}
      {topTools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Tool Sentiment Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topTools.map((tool, index) => (
                <div key={tool.tool} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="font-medium">{tool.tool}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {tool.count} posts
                    </span>
                  </div>
                  <div className={`font-semibold ${getSentimentColor(tool.avgSentiment)}`}>
                    {tool.avgSentiment.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {data.summary.positive}
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">Positive</div>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {data.summary.neutral}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300">Neutral</div>
        </div>
        <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {data.summary.negative}
          </div>
          <div className="text-sm text-red-700 dark:text-red-300">Negative</div>
        </div>
        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {Math.round(data.summary.avgSentiment * 10)}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">Index x10</div>
        </div>
      </div>
    </div>
  );
}

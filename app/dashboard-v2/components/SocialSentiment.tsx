'use client';

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

interface SentimentData {
  sentimentDay: string;
  language: string;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalCount: number;
  avgSentimentScore: number;
}

interface ApiResponse {
  data: SentimentData[];
  summary: {
    totalTweets: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
    avgSentimentScore: number;
    positivePercentage: number;
    neutralPercentage: number;
    negativePercentage: number;
  };
}

interface SocialSentimentProps {
  timeframe: number;
}

export default function SocialSentiment({ timeframe }: SocialSentimentProps) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [timeframe]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/social-sentiment?days=${timeframe}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch social sentiment:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section id="social" className="section">
        <h2 className="section-title">Social Sentiment</h2>
        <div className="card">
          <p className="text-gray-400">Loading social sentiment data...</p>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section id="social" className="section">
        <h2 className="section-title">Social Sentiment</h2>
        <div className="card">
          <p className="text-red-400">Failed to load social sentiment data</p>
        </div>
      </section>
    );
  }

  // Aggregate daily data for chart
  const dailyData = data.data.reduce((acc: Record<string, { positive: number; neutral: number; negative: number; total: number }>, row) => {
    const date = new Date(row.sentimentDay).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    if (!acc[date]) {
      acc[date] = { positive: 0, neutral: 0, negative: 0, total: 0 };
    }
    acc[date].positive += row.positiveCount;
    acc[date].neutral += row.neutralCount;
    acc[date].negative += row.negativeCount;
    acc[date].total += row.totalCount;
    return acc;
  }, {});

  const labels = Object.keys(dailyData).slice(-14); // Last 14 days
  const positivePercentages = labels.map((date) => {
    const day = dailyData[date];
    return day.total > 0 ? (day.positive / day.total) * 100 : 0;
  });
  const negativePercentages = labels.map((date) => {
    const day = dailyData[date];
    return day.total > 0 ? (day.negative / day.total) * 100 : 0;
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Positive',
        data: positivePercentages,
        borderColor: 'hsl(0, 0%, 90%)',
        backgroundColor: 'hsla(0, 0%, 90%, 0.2)',
        tension: 0.4,
      },
      {
        label: 'Negative',
        data: negativePercentages,
        borderColor: 'hsl(0, 0%, 50%)',
        backgroundColor: 'hsla(0, 0%, 50%, 0.2)',
        tension: 0.4,
        borderDash: [5, 5],
      },
    ],
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#e5e7eb',
        },
      },
      tooltip: {
        backgroundColor: '#374151',
        titleColor: '#e5e7eb',
        bodyColor: '#e5e7eb',
      },
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af' },
        grid: { color: '#374151' },
      },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          color: '#9ca3af',
          callback: (value) => value + '%',
        },
        grid: { color: '#374151' },
      },
    },
  };

  return (
    <section id="social" className="section">
      <div className="section-header">
        <h2 className="section-title">Social Sentiment</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400">Total Posts</h3>
          <p className="text-3xl font-bold mt-2">{data.summary.totalTweets.toLocaleString()}</p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400">Positive</h3>
          <p className="text-3xl font-bold mt-2 text-green-400">
            {data.summary.positivePercentage.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {data.summary.positiveCount.toLocaleString()} posts
          </p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400">Neutral</h3>
          <p className="text-3xl font-bold mt-2 text-gray-400">
            {data.summary.neutralPercentage.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {data.summary.neutralCount.toLocaleString()} posts
          </p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400">Negative</h3>
          <p className="text-3xl font-bold mt-2 text-red-400">
            {data.summary.negativePercentage.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {data.summary.negativeCount.toLocaleString()} posts
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Sentiment Trends (Last 14 Days)</h3>
        <div className="chart-container" style={{ height: '400px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Social Feed Preview */}
      <div className="card mt-6">
        <h3 className="text-lg font-semibold mb-4">Recent Social Activity</h3>
        <div className="space-y-4">
          {data.data.slice(0, 5).map((row, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg"
            >
              <div className="flex-1">
                <p className="text-sm text-gray-400">
                  {new Date(row.sentimentDay).toLocaleDateString()}
                </p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-green-400">
                    Positive: {row.positiveCount}
                  </span>
                  <span className="text-gray-400">
                    Neutral: {row.neutralCount}
                  </span>
                  <span className="text-red-400">
                    Negative: {row.negativeCount}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{row.language}</p>
                <p className="text-sm font-medium">{row.totalCount} posts</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

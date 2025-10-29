'use client';

import { useCallback, useEffect, useState } from 'react';
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

interface ProductResponse {
  dataByProduct: Record<string, Array<{
    day: string;
    positive_count: number;
    negative_count: number;
    neutral_count: number;
    total_count: number;
    avg_sentiment_score: number;
  }>>;
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
  const [products, setProducts] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [productData, setProductData] = useState<ProductResponse | null>(null);
  const [productLoading, setProductLoading] = useState(false);

  // Fetch available brands on mount
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await fetch('/api/social-sentiment/brands');
        const result = await response.json();
        if (result.products && Array.isArray(result.products)) {
          setProducts(result.products);
          setSelectedBrand(result.products[0] ?? null);
        }
      } catch (error) {
        console.error('Failed to fetch brands:', error);
      }
    };
    fetchBrands();
  }, []);

  // Fetch product data when timeframe or selected brand changes
  const fetchProductData = useCallback(async () => {
    if (!selectedBrand) {
      setProductData(null);
      return;
    }

    setProductLoading(true);
    try {
      const response = await fetch(
        `/api/social-sentiment/by-product?days=${timeframe}&products=${encodeURIComponent(selectedBrand)}`,
      );
      const result = await response.json();
      setProductData(result);
    } catch (error) {
      console.error('Failed to fetch product sentiment:', error);
    } finally {
      setProductLoading(false);
    }
  }, [timeframe, selectedBrand]);

  useEffect(() => {
    fetchProductData();
  }, [fetchProductData]);

  const fetchData = useCallback(async () => {
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
  }, [timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Only show the loading placeholder when there's no data yet (initial load)
  if (loading && !data) {
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

  // Determine which data to use for summary
  const summaryData = productData?.summary || data?.summary;

  // Format date key helper
  const formatDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  // Build continuous date range
  const dateKeysAsc = Array.from({ length: timeframe }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((timeframe - 1) - i));
    return formatDateKey(d);
  });

  const labels = dateKeysAsc.map((key) => {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, (m ?? 1) - 1, d ?? 1);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  // Build chart datasets
  let datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    tension: number;
    borderDash?: number[];
  }> = [];

  if (productData && productData.dataByProduct && selectedBrand) {
    const productRows = productData.dataByProduct[selectedBrand] ?? [];
    const dayMap = new Map(productRows.map(row => [row.day.split('T')[0], row]));

    const positiveData = dateKeysAsc.map((key) => {
      const row = dayMap.get(key);
      return row && row.total_count > 0 ? (row.positive_count / row.total_count) * 100 : 0;
    });

    const negativeData = dateKeysAsc.map((key) => {
      const row = dayMap.get(key);
      return row && row.total_count > 0 ? (row.negative_count / row.total_count) * 100 : 0;
    });

    datasets = [
      {
        label: 'Positive',
        data: positiveData,
        borderColor: 'hsl(0, 0%, 90%)',
        backgroundColor: 'hsla(0, 0%, 90%, 0.2)',
        tension: 0.4,
      },
      {
        label: 'Negative',
        data: negativeData,
        borderColor: 'hsl(0, 0%, 50%)',
        backgroundColor: 'hsla(0, 0%, 50%, 0.2)',
        tension: 0.4,
        borderDash: [5, 5],
      },
    ];
  } else if (data && data.data) {
    const aggregatedByDay = data.data.reduce((acc: Record<string, { positive: number; neutral: number; negative: number; total: number }>, row) => {
      const dateKey = row.sentimentDay.split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { positive: 0, neutral: 0, negative: 0, total: 0 };
      }
      acc[dateKey].positive += row.positiveCount;
      acc[dateKey].neutral += row.neutralCount;
      acc[dateKey].negative += row.negativeCount;
      acc[dateKey].total += row.totalCount;
      return acc;
    }, {});

    const positivePercentages = dateKeysAsc.map((key) => {
      const day = aggregatedByDay[key] ?? { positive: 0, neutral: 0, negative: 0, total: 0 };
      return day.total > 0 ? (day.positive / day.total) * 100 : 0;
    });
    const negativePercentages = dateKeysAsc.map((key) => {
      const day = aggregatedByDay[key] ?? { positive: 0, neutral: 0, negative: 0, total: 0 };
      return day.total > 0 ? (day.negative / day.total) * 100 : 0;
    });

    datasets = [
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
    ];
  }

  const chartData = {
    labels,
    datasets,
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
          callback: (value: string | number) => value + '%',
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

      {/* Brand Filter */}
      {products.length > 0 && (
        <div className="card mb-6">
          <fieldset role="radiogroup" aria-labelledby="brand-filter-label">
            <div className="flex items-center justify-between mb-3">
              <h3 id="brand-filter-label" className="text-sm font-medium text-gray-400">Filter by Brand</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {products.map((product) => (
                <label key={product} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="brand"
                    value={product}
                    checked={selectedBrand === product}
                    onChange={() => setSelectedBrand(product)}
                    className="w-4 h-4 bg-gray-700 border border-gray-600 rounded-full cursor-pointer"
                  />
                  <span className="text-sm text-gray-300">{product}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {/* Summary Cards */}
      {summaryData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <h3 className="text-sm font-medium text-gray-400">Total Posts</h3>
            <p className="text-3xl font-bold mt-2">{summaryData.totalTweets.toLocaleString()}</p>
          </div>
          <div className="card">
            <h3 className="text-sm font-medium text-gray-400">Positive</h3>
            <p className="text-3xl font-bold mt-2 text-green-400">
              {summaryData.positivePercentage.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {summaryData.positiveCount.toLocaleString()} posts
            </p>
          </div>
          <div className="card">
            <h3 className="text-sm font-medium text-gray-400">Neutral</h3>
            <p className="text-3xl font-bold mt-2 text-gray-400">
              {summaryData.neutralPercentage.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {summaryData.neutralCount.toLocaleString()} posts
            </p>
          </div>
          <div className="card">
            <h3 className="text-sm font-medium text-gray-400">Negative</h3>
            <p className="text-3xl font-bold mt-2 text-red-400">
              {summaryData.negativePercentage.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {summaryData.negativeCount.toLocaleString()} posts
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="card">
        <h3 id="sentiment" className="text-lg font-semibold mb-4">
          Sentiment Trends (Last {timeframe} Days)
          {productLoading && ' — Loading...'}
        </h3>
        {productLoading ? (
          <div className="flex items-center justify-center h-96 text-gray-400">
            <p>Loading chart data...</p>
          </div>
        ) : chartData.datasets.length > 0 ? (
          <div className="chart-container" style={{ height: '400px' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-96 text-gray-400">
            <p>No data available for selected brand in this period</p>
          </div>
        )}
      </div>

      {/* Social Feed Preview */}
      {data && data.data.length > 0 && (
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
      )}
    </section>
  );
}

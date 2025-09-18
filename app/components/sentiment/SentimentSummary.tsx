'use client';

import { useEffect, useState } from 'react';

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

  const getSentimentLabel = (score: number) => {
    if (score > 2) return 'Very Positive';
    if (score > 0.5) return 'Positive';
    if (score > -0.5) return 'Neutral';
    if (score > -2) return 'Negative';
    return 'Very Negative';
  };



  if (loading) {
    return (
      <div className="metrics-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="research-card research-card-skeleton">
            <div className="research-card-content">
              <div className="skeleton-text" style={{ width: "60%", height: "16px", marginBottom: "8px" }}></div>
              <div className="skeleton-text" style={{ width: "40%", height: "24px", marginBottom: "8px" }}></div>
              <div className="skeleton-text" style={{ width: "80%", height: "14px" }}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="research-card research-error-state">
        <div className="error-content">
          <div className="error-icon">!</div>
          <h3 className="error-title">Failed to load sentiment data</h3>
          <p className="error-message">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="metrics-grid">
      {/* Overall Sentiment Index */}
      <div className="research-card">
        <div className="research-card-header">
          <div className="research-card-badges">
            <span className="research-badge research-badge-source">
              Overall Sentiment
            </span>
          </div>
        </div>
        <div className="research-card-content">
          <div className="metric-value" style={{ fontSize: '2.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            {data.summary.avgSentiment.toFixed(2)}
          </div>
          <div className="metric-subtitle" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {getSentimentLabel(data.summary.avgSentiment)}
          </div>
        </div>
      </div>

      {/* Total Posts */}
      <div className="research-card">
        <div className="research-card-header">
          <div className="research-card-badges">
            <span className="research-badge research-badge-source">
              Total Posts
            </span>
          </div>
        </div>
        <div className="research-card-content">
          <div className="metric-value" style={{ fontSize: '2.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            {data.total}
          </div>
          <div className="metric-subtitle" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {window === '24h' ? 'Last 24 hours' :
              window === '7d' ? 'Last 7 days' :
                window === '30d' ? 'Last 30 days' : 'All time'}
          </div>
        </div>
      </div>

      {/* Positive Rate */}
      <div className="research-card">
        <div className="research-card-header">
          <div className="research-card-badges">
            <span className="research-badge research-badge-source">
              Positive Rate
            </span>
          </div>
        </div>
        <div className="research-card-content">
          <div className="metric-value" style={{ fontSize: '2.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            {data.summary.positiveRate.toFixed(1)}%
          </div>
          <div className="metric-subtitle" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {data.summary.positive} positive posts
          </div>
        </div>
      </div>

      {/* Top Tool */}
      <div className="research-card">
        <div className="research-card-header">
          <div className="research-card-badges">
            <span className="research-badge research-badge-source">
              Leading Tool
            </span>
          </div>
        </div>
        <div className="research-card-content">
          <div className="metric-value" style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            AmpCode
          </div>
          <div className="metric-subtitle" style={{ color: 'hsl(var(--muted-foreground))' }}>
            2.09 avg sentiment
          </div>
        </div>
      </div>
    </div>
  );
}

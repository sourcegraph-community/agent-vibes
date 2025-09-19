'use client';

import { useEffect, useState } from 'react';

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

  const getSentimentBadgeClass = (score: number) => {
    return 'research-badge-source'; // consistent muted styling
  };

  const getBarColor = (score: number) => {
    if (score > 1) return 'hsl(var(--success))'; // muted green
    if (score > 0) return 'hsl(var(--muted-foreground))'; // muted neutral
    if (score < -1) return 'hsl(var(--error))'; // muted red
    return 'hsl(var(--muted))'; // neutral
  };

  const getBarWidth = (count: number, maxCount: number) => {
    return maxCount > 0 ? (count / maxCount) * 100 : 0;
  };

  if (loading) {
    return (
      <div className="research-card research-card-skeleton">
        <div className="research-card-header">
          <div className="research-card-badges">
            <div className="skeleton-badge" style={{ width: "120px" }}></div>
          </div>
        </div>
        <div className="research-card-content">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <div className="skeleton-text" style={{ width: "60%", height: "16px", marginBottom: "8px" }}></div>
                <div className="skeleton-text" style={{ width: "100%", height: "24px" }}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="research-card research-error-state">
        <div className="error-content">
          <div className="error-icon">!</div>
          <h3 className="error-title">Failed to load comparison data</h3>
          <p className="error-message">{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="research-card research-empty-state">
        <div className="empty-content">
          <div className="empty-icon">-</div>
          <h3 className="empty-title">No comparison data</h3>
          <p className="empty-message">
            No tool comparison data available for the selected time period
          </p>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <div className="research-card">
      <div className="research-card-header">
        <div className="research-card-badges">
          <span className="research-badge research-badge-source">
            Tool Comparison
          </span>
        </div>
      </div>

      <div className="research-card-content">
        <div className="space-y-8">
          {data.map((tool, index) => (
            <div key={tool.tool} className="tool-comparison-item">
              {/* Tool header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <span className="research-label" style={{ textTransform: 'none', fontSize: '1.125rem', fontWeight: '600' }}>
                    {tool.tool}
                  </span>
                  <span className={`research-badge ${getSentimentBadgeClass(tool.avgSentiment)}`} style={{ fontSize: '0.875rem' }}>
                    {tool.avgSentiment.toFixed(2)}
                  </span>
                </div>
                <div className="research-citations">
                  {tool.count} posts
                </div>
              </div>

              {/* Sentiment bar */}
              <div className="relative mb-4">
                {/* Background bar */}
                <div 
                  className="w-full rounded overflow-hidden"
                  style={{ 
                    height: '2rem', 
                    backgroundColor: 'hsl(var(--muted))'
                  }}
                >
                  {/* Sentiment colored bar */}
                  <div
                    className="h-full transition-all duration-300 relative flex items-center"
                    style={{ 
                      width: `${getBarWidth(tool.count, maxCount)}%`,
                      backgroundColor: getBarColor(tool.avgSentiment),
                      minWidth: '60px'
                    }}
                  >
                    {/* Positive/Negative breakdown overlay */}
                    <div className="absolute inset-0 flex items-center justify-end pr-4">
                      <span 
                        className="text-sm font-medium"
                        style={{ color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
                      >
                        {tool.positive}+ | {tool.negative}-
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Engagement info */}
              <div className="research-authors" style={{ borderTop: 'none', paddingTop: '0', marginTop: '1rem' }}>
                <span className="research-label">Engagement:</span>
                <span className="research-authors-list">
                  {Math.round(tool.totalEngagement).toLocaleString()} total interactions
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="research-card-footer">
          <div className="research-authors" style={{ borderTop: 'none' }}>
            <span className="research-authors-list" style={{ fontStyle: 'italic', fontSize: '0.75rem' }}>
              Bar width represents post volume. Color and score show average sentiment (-5 to +5).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

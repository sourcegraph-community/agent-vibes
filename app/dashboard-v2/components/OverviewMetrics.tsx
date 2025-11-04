"use client";

import { useEffect, useMemo, useState } from "react";

interface OverviewResponse {
  periodDays: number;
  overallSentiment: {
    positivePercentage: number;
    deltaPercentage: number;
  };
  contentAnalyzed: {
    total: number;
    tweets: number;
    rss: number;
    deltaPercentage: number;
  };
  activeDiscussions: {
    totalTweets: number;
    deltaPercentage: number;
  };
  researchPapers: {
    count: number;
    deltaPercentage: number;
  };
  generatedAt: string;
}

export default function OverviewMetrics({ timeframe }: { timeframe: number }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dashboard-v2/overview?days=${timeframe}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: OverviewResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; controller.abort(); };
  }, [timeframe]);

  const fmtInt = (n: number) => n.toLocaleString();
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  const sentimentClass = useMemo(() => (data && data.overallSentiment.deltaPercentage >= 0 ? "positive" : "negative"), [data]);
  const contentClass = useMemo(() => (data && data.contentAnalyzed.deltaPercentage >= 0 ? "positive" : "negative"), [data]);
  const activityClass = useMemo(() => (data && data.activeDiscussions.deltaPercentage >= 0 ? "positive" : "negative"), [data]);
  const researchClass = useMemo(() => (data && data.researchPapers.deltaPercentage >= 0 ? "positive" : "negative"), [data]);

  if (loading && !data) {
    return (
      <div className="metrics-grid">
        <div className="card"><p className="text-gray-400">Loading overview…</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="metrics-grid">
        <div className="card"><p className="text-red-400">{error}</p></div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="metrics-grid">
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <h3>Overall Sentiment</h3>
            <div className={`trend-indicator ${sentimentClass}`}>
              <span>{data.overallSentiment.deltaPercentage >= 0 ? "+" : ""}{data.overallSentiment.deltaPercentage.toFixed(1)}%</span>
            </div>
          </div>
          <p className="card-description">Change vs previous {data.periodDays} days</p>
        </div>
        <div className="card-content">
          <div className="metric-value">{fmtPct(data.overallSentiment.positivePercentage)}</div>
          <div className="metric-subtitle">Positive across all sources</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <h3>Content Analyzed</h3>
            <div className={`trend-indicator ${contentClass}`}>
              <span>{data.contentAnalyzed.deltaPercentage >= 0 ? "+" : ""}{data.contentAnalyzed.deltaPercentage.toFixed(1)}%</span>
            </div>
          </div>
          <p className="card-description">Tweets + RSS in this window</p>
        </div>
        <div className="card-content">
          <div className="metric-value">{fmtInt(data.contentAnalyzed.total)}</div>
          <div className="metric-subtitle">Tweets: {fmtInt(data.contentAnalyzed.tweets)} · RSS: {fmtInt(data.contentAnalyzed.rss)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <h3>Active Discussions</h3>
            <div className={`trend-indicator ${activityClass}`}>
              <span>{data.activeDiscussions.deltaPercentage >= 0 ? "+" : ""}{data.activeDiscussions.deltaPercentage.toFixed(1)}%</span>
            </div>
          </div>
          <p className="card-description">Change vs previous window</p>
        </div>
        <div className="card-content">
          <div className="metric-value">{fmtInt(data.activeDiscussions.totalTweets)}</div>
          <div className="metric-subtitle">Across social platforms</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <h3>Research Papers</h3>
            <div className={`trend-indicator ${researchClass}`}>
              <span>{data.researchPapers.deltaPercentage >= 0 ? "+" : ""}{data.researchPapers.deltaPercentage.toFixed(1)}%</span>
            </div>
          </div>
          <p className="card-description">New publications</p>
        </div>
        <div className="card-content">
          <div className="metric-value">{fmtInt(data.researchPapers.count)}</div>
          <div className="metric-subtitle">This period</div>
        </div>
      </div>
    </div>
  );
}

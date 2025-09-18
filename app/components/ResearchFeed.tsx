"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  Paper,
  PapersResponse,
  ResearchApiError,
  TimeWindow,
} from "@/types/research";
import ResearchTimeFilter from "./ResearchTimeFilter";

interface ResearchFeedProps {
  className?: string;
}

export default function ResearchFeed({ className }: ResearchFeedProps) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("3m");

  const fetchPapers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/research?window=${timeWindow}`);

      if (!response.ok) {
        const errorData: ResearchApiError = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: PapersResponse = await response.json();
      setPapers(data.papers);
      setLastUpdated(data.lastUpdated);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load research papers";
      setError(errorMessage);
      console.error("ResearchFeed error:", err);
    } finally {
      setLoading(false);
    }
  }, [timeWindow]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(date));
  }

  function formatArxivClass(arxivClass: string): string {
    // Convert cs.AI to CS.AI, cs.CL to CS.CL, etc.
    return arxivClass.toUpperCase().replace("CS.", "CS.");
  }

  if (loading) {
    return (
      <div className={`research-feed ${className || ""}`}>
        <div className="feed-controls">
          <ResearchTimeFilter value={timeWindow} onChange={setTimeWindow} />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="research-card research-card-skeleton">
            <div className="research-card-header">
              <div className="research-card-badges">
                <div className="skeleton-badge" style={{ width: "60px" }}></div>
                <div className="skeleton-badge" style={{ width: "80px" }}></div>
                <div className="skeleton-badge" style={{ width: "70px" }}></div>
              </div>
              <div className="research-card-meta">
                <div className="skeleton-text" style={{ width: "90px", height: "14px" }}></div>
                <div className="skeleton-text" style={{ width: "70px", height: "12px" }}></div>
              </div>
            </div>
            <div className="research-card-content">
              <div className="skeleton-text" style={{ width: "85%", height: "20px", marginBottom: "16px" }}></div>
              <div className="skeleton-text" style={{ width: "100%", height: "16px", marginBottom: "8px" }}></div>
              <div className="skeleton-text" style={{ width: "90%", height: "16px", marginBottom: "8px" }}></div>
              <div className="skeleton-text" style={{ width: "75%", height: "16px", marginBottom: "16px" }}></div>
            </div>
            <div className="research-card-footer">
              <div className="skeleton-text" style={{ width: "200px", height: "14px" }}></div>
              <div className="skeleton-text" style={{ width: "120px", height: "14px" }}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`research-feed ${className || ""}`}>
        <div className="feed-controls">
          <ResearchTimeFilter value={timeWindow} onChange={setTimeWindow} />
        </div>
        <div className="research-card research-error-state">
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <h3 className="error-title">Failed to load research papers</h3>
            <p className="error-message">{error}</p>
            <button
              className="retry-button"
              onClick={fetchPapers}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className={`research-feed ${className || ""}`}>
        <div className="feed-controls">
          <ResearchTimeFilter value={timeWindow} onChange={setTimeWindow} />
        </div>
        <div className="research-card research-empty-state">
          <div className="empty-content">
            <div className="empty-icon">📚</div>
            <h3 className="empty-title">No research papers found</h3>
            <p className="empty-message">
              Try adjusting the time range or check back later for new papers.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`research-feed ${className || ""}`}>
      <div className="feed-controls">
        <ResearchTimeFilter value={timeWindow} onChange={setTimeWindow} />
      </div>

      {lastUpdated && (
        <div className="feed-meta">
          <span className="last-updated">
            Last updated: {formatDate(new Date(lastUpdated))}
          </span>
        </div>
      )}

      {papers.map((paper) => (
        <article key={paper.id} className="research-card">
          <div className="research-card-header">
            <div className="research-card-badges">
              <span className="research-badge research-badge-source">
                arXiv
              </span>
              <span className={`research-badge research-badge-category ${paper.arxivClass.toLowerCase().replace('.', '-')}`}>
                {formatArxivClass(paper.arxivClass)}
              </span>
              {paper.score && (
                <span className="research-badge research-badge-score">
                  Score: {Math.round(paper.score)}
                </span>
              )}
            </div>
            <div className="research-card-meta">
              <span className="research-published">
                {formatDate(paper.published)}
              </span>
              {paper.citations > 0 && (
                <span className="research-citations">
                  {paper.citations} citation{paper.citations !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <div className="research-card-content">
            <h3 className="research-card-title">
              {paper.pdf ? (
                <a
                  href={paper.pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="research-title-link"
                >
                  {paper.title}
                </a>
              ) : (
                paper.title
              )}
            </h3>

            <p className="research-card-abstract">{paper.abstract}</p>

            <div className="research-card-footer">
              <div className="research-authors">
                <span className="research-label">Authors:</span>
                <span className="research-authors-list" title={paper.authors}>
                  {paper.authors.length > 60
                    ? `${paper.authors.substring(0, 57)}...`
                    : paper.authors}
                </span>
              </div>

              <div className="research-card-actions">
                {paper.pdf && (
                  <a
                    href={paper.pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="research-action-link"
                  >
                    📄 PDF
                  </a>
                )}
                <span className="research-bibcode">
                  ID: {paper.id}
                </span>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

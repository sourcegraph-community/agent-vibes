'use client';

import { useState, useEffect } from 'react';
import type { Paper, PapersResponse, ResearchApiError } from '@/types/research';

interface ResearchFeedProps {
  className?: string;
}

export default function ResearchFeed({ className }: ResearchFeedProps) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    fetchPapers();
  }, []);

  async function fetchPapers() {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/research');
      
      if (!response.ok) {
        const errorData: ResearchApiError = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data: PapersResponse = await response.json();
      setPapers(data.papers);
      setLastUpdated(data.lastUpdated);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load research papers';
      setError(errorMessage);
      console.error('ResearchFeed error:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date));
  }

  function formatArxivClass(arxivClass: string): string {
    // Convert cs.AI to CS.AI, cs.CL to CS.CL, etc.
    return arxivClass.toUpperCase().replace('CS.', 'CS.');
  }

  if (loading) {
    return (
      <div className={`content-feed ${className}`}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="content-item skeleton">
            <div className="content-header">
              <div className="source-badge academic skeleton-text" style={{width: '100px'}}></div>
              <span className="content-time skeleton-text" style={{width: '80px'}}></span>
            </div>
            <div className="content-title skeleton-text" style={{width: '70%', height: '24px'}}></div>
            <div className="content-summary">
              <div className="skeleton-text" style={{width: '100%', height: '16px', marginBottom: '8px'}}></div>
              <div className="skeleton-text" style={{width: '80%', height: '16px'}}></div>
            </div>
            <div className="content-meta">
              <span className="skeleton-text" style={{width: '60px'}}></span>
              <span className="skeleton-text" style={{width: '80px'}}></span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`error-state ${className}`}>
        <div className="error-icon">⚠️</div>
        <p className="error-message">Failed to load research papers: {error}</p>
        <button 
          className="retry-button button button-outline"
          onClick={fetchPapers}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className={`empty-state ${className}`}>
        <div className="empty-icon">📚</div>
        <p>No research papers found</p>
      </div>
    );
  }

  return (
    <div className={`content-feed ${className}`}>
      {lastUpdated && (
        <div className="feed-meta">
          <span className="last-updated">
            Last updated: {formatDate(new Date(lastUpdated))}
          </span>
        </div>
      )}
      
      {papers.map((paper) => (
        <article key={paper.id} className="content-item" data-type="academic">
          <div className="content-header">
            <div className="source-badge academic">
              <i data-lucide="book-open"></i>
              <span>arXiv</span>
            </div>
            <span className="content-time">{formatDate(paper.published)}</span>
          </div>
          
          <h3 className="content-title">
            {paper.pdf ? (
              <a 
                href={paper.pdf} 
                target="_blank" 
                rel="noopener noreferrer"
                className="paper-link"
              >
                {paper.title}
              </a>
            ) : (
              paper.title
            )}
          </h3>
          
          <p className="content-summary">{paper.abstract}</p>
          
          <div className="content-meta">
            <span className="content-tag academic">
              {formatArxivClass(paper.arxivClass)}
            </span>
            
            {paper.citations > 0 && (
              <span className="content-impact">
                {paper.citations} citation{paper.citations !== 1 ? 's' : ''}
              </span>
            )}
            
            <span className="content-authors" title={paper.authors}>
              {paper.authors.length > 50 
                ? `${paper.authors.substring(0, 47)}...`
                : paper.authors
              }
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

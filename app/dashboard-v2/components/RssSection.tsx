'use client';

import { useEffect, useState } from 'react';
import RssEntryCard from './RssEntryCard';

interface RssEntry {
  id: number;
  title: string;
  url: string;
  summary: string | null;
  author?: string;
  publishedAt: string;
  feedTitle: string;
  category: 'product_updates' | 'industry_research' | 'perspectives' | 'uncategorized';
  starred?: boolean;
  readingTime?: number;
}

interface RssSectionProps {
  id: string;
  title: string;
  category: 'product_updates' | 'industry_research' | 'perspectives' | 'uncategorized';
  limit?: number;
  showLoadMore?: boolean;
  showBadges?: boolean; // default true; set false for sections where category is implied
}

export default function RssSection({
  id,
  title,
  category,
  limit = 8,
  showLoadMore = false,
  showBadges = true,
}: RssSectionProps) {
  const [entries, setEntries] = useState<RssEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/rss/entries?category=${category}&limit=${limit}`);

        if (!response.ok) {
          throw new Error('Failed to fetch RSS entries');
        }

        const data = await response.json();
        setEntries(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [category, limit]);

  if (loading) {
    return (
      <section id={id} className="section">
        <div className="section-header">
          <h2 className="section-title">{title}</h2>
        </div>
        <div className="card">
          <p className="text-gray-400">Loading {title.toLowerCase()}...</p>
        </div>
      </section>
    );
  }

  if (error || entries.length === 0) {
    return (
      <section id={id} className="section">
        <div className="section-header">
          <h2 className="section-title">{title}</h2>
        </div>
        <div className="card">
          <p className="text-gray-400">
            {error ? `Error: ${error}` : `No ${title.toLowerCase()} available yet.`}
            <br />
            Configure RSS feeds in Miniflux to populate this section.
            <br />
            <a
              href="https://github.com/sourcegraph-community/agent-vibes/blob/main/docs/miniflux-integration.md"
              className="text-blue-400 hover:text-blue-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              Setup guide →
            </a>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        {entries.length > 0 && (
          <span className="text-sm text-gray-400">{entries.length} items</span>
        )}
      </div>

      <div className="highlights-grid">
        {entries.map((entry) => (
          <RssEntryCard key={entry.id} {...entry} showBadge={showBadges} />
        ))}
      </div>

      {showLoadMore && entries.length >= limit && (
        <div className="mt-4 text-center">
          <button className="text-blue-400 hover:text-blue-300 text-sm">
            Load more →
          </button>
        </div>
      )}
    </section>
  );
}

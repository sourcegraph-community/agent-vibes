'use client';

import { useEffect, useState } from 'react';

interface Tweet {
  id: string;
  text: string;
  sentiment: number;
  tool: string;
  createdAt: string;
  author: {
    userName: string;
    name: string;
  };
  url: string;
  engagement: {
    likes: number;
    retweets: number;
    replies: number;
    views: number;
    score: number;
  };
  sentimentCategory: 'positive' | 'negative' | 'neutral';
  sentimentColor: string;
}

interface TweetFeedProps {
  tool?: string;
  window?: string;
  limit?: number;
}

export function TweetFeedWithSentiment({ tool = 'all', window = '7d', limit = 25 }: TweetFeedProps) {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTweets = async (offset = 0, append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams();
      if (tool && tool !== 'all') params.append('tool', tool);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const response = await fetch(`/api/tweets/sentiment?${params}`);
      if (!response.ok) throw new Error('Failed to fetch tweets');

      const result = await response.json();

      if (append) {
        setTweets(prev => [...prev, ...result.tweets]);
      } else {
        setTweets(result.tweets);
      }

      setHasMore(result.pagination.hasMore);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tweets');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchTweets(0, false);
  }, [tool, window]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchTweets(tweets.length, true);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  const getSentimentBadgeClass = (category: string) => {
    return 'research-badge-source'; // consistent muted styling for all
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
      <div className="sentiment-feed">
        <div className="section-header">
          <h3 className="section-title">Recent Social Posts</h3>
          <p className="section-description">Latest X posts about AI coding tools</p>
        </div>
        
        <div className="space-y-0">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="research-card research-card-skeleton">
              <div className="research-card-header">
                <div className="research-card-badges">
                  <div className="skeleton-badge" style={{ width: "80px" }}></div>
                  <div className="skeleton-badge" style={{ width: "60px" }}></div>
                </div>
                <div className="research-card-meta">
                  <div className="skeleton-text" style={{ width: "90px", height: "14px" }}></div>
                </div>
              </div>
              <div className="research-card-content">
                <div className="skeleton-text" style={{ width: "100%", height: "16px", marginBottom: "8px" }}></div>
                <div className="skeleton-text" style={{ width: "85%", height: "16px", marginBottom: "8px" }}></div>
                <div className="skeleton-text" style={{ width: "75%", height: "16px" }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sentiment-feed">
        <div className="section-header">
          <h3 className="section-title">Recent Social Posts</h3>
          <p className="section-description">Latest X posts about AI coding tools</p>
        </div>
        
        <div className="research-card research-error-state">
          <div className="error-content">
            <div className="error-icon">!</div>
            <h3 className="error-title">Failed to load posts</h3>
            <p className="error-message">{error}</p>
            <button
              className="retry-button"
              onClick={() => fetchTweets(0, false)}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sentiment-feed">
      <div className="section-header">
        <h3 className="section-title">
          Recent Social Posts {tool !== 'all' && `about ${tool}`}
        </h3>
        <p className="section-description">
          {tweets.length} posts analyzed • Last 7 days
        </p>
      </div>

      {tweets.length === 0 ? (
        <div className="research-card research-empty-state">
          <div className="empty-content">
            <div className="empty-icon">-</div>
            <h3 className="empty-title">No posts found</h3>
            <p className="empty-message">
              No social media posts found for the selected filters
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-0">
            {tweets.map((tweet) => (
              <article key={tweet.id} className="research-card">
                <div className="research-card-header">
                  <div className="research-card-badges">
                    <span className={`research-badge ${getSentimentBadgeClass(tweet.sentimentCategory)}`}>
                      {getSentimentLabel(tweet.sentiment)} {tweet.sentiment > 0 ? '+' : ''}{tweet.sentiment.toFixed(1)}
                    </span>
                    <span className="research-badge research-badge-source">
                      {tweet.tool}
                    </span>
                  </div>
                  <div className="research-card-meta">
                    <span className="research-published">
                      {formatDate(tweet.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="research-card-content">
                  {/* Author */}
                  <div className="tweet-author" style={{ marginBottom: '1rem' }}>
                    <span className="research-label">@{tweet.author.userName}</span>
                    <span className="research-authors-list">{tweet.author.name}</span>
                  </div>

                  {/* Tweet content */}
                  <p className="research-card-abstract">
                    {tweet.text}
                  </p>

                  <div className="research-card-footer">
                    {/* Engagement stats */}
                    <div className="research-authors">
                      <span className="research-label">Engagement:</span>
                      <span className="research-authors-list">
                        {[
                          tweet.engagement.likes > 0 && `${tweet.engagement.likes} likes`,
                          tweet.engagement.retweets > 0 && `${tweet.engagement.retweets} reposts`,
                          tweet.engagement.replies > 0 && `${tweet.engagement.replies} replies`,
                          tweet.engagement.views > 0 && `${tweet.engagement.views.toLocaleString()} views`
                        ].filter(Boolean).join(' • ') || 'No engagement data'}
                      </span>
                    </div>

                    <div className="research-card-actions">
                      <a
                        href={tweet.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="research-action-link"
                      >
                        View Post
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="text-center" style={{ marginTop: '2rem' }}>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="retry-button"
                style={{ 
                  background: loadingMore ? 'hsl(var(--muted))' : 'hsl(var(--primary))',
                  color: loadingMore ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))'
                }}
              >
                {loadingMore ? 'Loading...' : 'Load More Posts'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

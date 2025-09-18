'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';

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

  const getSentimentBadgeColor = (category: string): 'default' | 'product' | 'research' | 'perspective' | 'social' | 'academic' => {
    switch (category) {
      case 'positive': return 'research'; // green
      case 'negative': return 'perspective'; // red-ish
      default: return 'default';
    }
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
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Recent Posts
          </h3>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Recent Posts
          </h3>
          <div className="text-red-600 dark:text-red-400">
            Error loading tweets: {error}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Recent Posts {tool !== 'all' && `about ${tool}`}
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {tweets.length} posts
          </span>
        </div>

        {tweets.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400 text-center py-8">
            No posts found for the selected filters
          </div>
        ) : (
          <div className="space-y-4">
            {tweets.map((tweet) => (
              <div
                key={tweet.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start gap-3 mb-3">
                  {/* Author info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {tweet.author.name}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">
                        @{tweet.author.userName}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 text-sm">
                        •
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">
                        {formatDate(tweet.createdAt)}
                      </span>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getSentimentBadgeColor(tweet.sentimentCategory)}>
                        {getSentimentLabel(tweet.sentiment)} ({tweet.sentiment > 0 ? '+' : ''}{tweet.sentiment.toFixed(1)})
                      </Badge>
                      <Badge variant="product">
                        {tweet.tool}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Tweet text */}
                <div className="mb-3">
                  <p className="text-gray-900 dark:text-gray-100 leading-relaxed">
                    {tweet.text}
                  </p>
                </div>

                {/* Engagement and link */}
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-4">
                    {tweet.engagement.likes > 0 && (
                      <span>❤️ {tweet.engagement.likes}</span>
                    )}
                    {tweet.engagement.retweets > 0 && (
                      <span>🔁 {tweet.engagement.retweets}</span>
                    )}
                    {tweet.engagement.replies > 0 && (
                      <span>💬 {tweet.engagement.replies}</span>
                    )}
                    {tweet.engagement.views > 0 && (
                      <span>👁️ {tweet.engagement.views.toLocaleString()}</span>
                    )}
                  </div>

                  <a
                    href={tweet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 dark:text-blue-400 hover:underline"
                  >
                    View on X →
                  </a>
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
                >
                  {loadingMore ? 'Loading...' : 'Load More Posts'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

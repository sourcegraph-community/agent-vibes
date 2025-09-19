'use client';

import { SentimentSummary } from './sentiment/SentimentSummary';
import { TweetFeedWithSentiment } from './sentiment/TweetFeedWithSentiment';
import { ToolSentimentBar } from './sentiment/ToolSentimentBar';
import { SentimentTrendChart } from './sentiment/SentimentTrendChart';

export function SentimentDashboardPreview() {
  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <SentimentSummary window="7d" />
      
      {/* Trend Chart and Tool Comparison Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SentimentTrendChart window="7d" />
        <ToolSentimentBar window="7d" />
      </div>
      
      {/* Recent Posts with Sentiment */}
      <TweetFeedWithSentiment window="7d" limit={10} />
    </div>
  );
}

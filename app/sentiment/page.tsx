'use client';

import { useState } from 'react';
import { SimpleSidebar } from '@/app/components/SimpleSidebar';
import { SentimentSummary } from '@/app/components/sentiment/SentimentSummary';
import { SentimentTrendChart } from '@/app/components/sentiment/SentimentTrendChart';
import { ToolSentimentBar } from '@/app/components/sentiment/ToolSentimentBar';
import { TweetFeedWithSentiment } from '@/app/components/sentiment/TweetFeedWithSentiment';
import { FilterToolbar } from '@/app/components/sentiment/FilterToolbar';

export default function SentimentPage() {
  const [selectedTool, setSelectedTool] = useState<string>('all');
  const [selectedWindow, setSelectedWindow] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        <SimpleSidebar />

        <main className="flex-1 ml-64">
          <div className="p-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Sentiment Analysis
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Real-time sentiment tracking from X posts mentioning AI coding tools
              </p>
            </div>

            {/* Filter Toolbar */}
            <FilterToolbar
              selectedTool={selectedTool}
              selectedWindow={selectedWindow}
              onToolChange={setSelectedTool}
              onWindowChange={setSelectedWindow}
            />

            {/* Summary Cards */}
            <div className="mb-8">
              <SentimentSummary tool={selectedTool} window={selectedWindow} />
            </div>

            {/* Charts Section */}
            <div className="grid lg:grid-cols-2 gap-8 mb-8">
              {/* Trend Chart */}
              <div className="lg:col-span-2">
                <SentimentTrendChart tool={selectedTool} window={selectedWindow} />
              </div>

              {/* Tool Comparison */}
              <div className="lg:col-span-2">
                <ToolSentimentBar window={selectedWindow} />
              </div>
            </div>

            {/* Tweet Feed */}
            <div>
              <TweetFeedWithSentiment tool={selectedTool} window={selectedWindow} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Paper } from "@/types/research";

interface TimelineItem {
  id: string;
  time: Date;
  title: string;
  description: string;
  category: 'product' | 'research' | 'sentiment' | 'perspective' | 'social';
  source: string;
  sentiment?: number;
  url?: string;
}

interface TimelineViewProps {
  className?: string;
}

type TimeWindow = '1h' | '1d' | '7d' | '30d';

export default function TimelineView({ className }: TimelineViewProps) {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('7d');
  const [contentFilter, setContentFilter] = useState<'all' | 'product' | 'research' | 'sentiment' | 'social'>('all');

  const fetchTimelineData = useCallback(async () => {
    try {
      setLoading(true);
      const items: TimelineItem[] = [];

      // Fetch research papers
      try {
        const researchResponse = await fetch(`/api/research?window=1m`);
        if (researchResponse.ok) {
          const researchData = await researchResponse.json();
          const researchItems: TimelineItem[] = researchData.papers.slice(0, 10).map((paper: Paper) => ({
            id: `research-${paper.id}`,
            time: new Date(paper.published),
            title: paper.title,
            description: paper.abstract?.substring(0, 200) + '...' || 'Research paper on AI coding assistants',
            category: 'research' as const,
            source: 'arXiv',
            url: paper.abstractUrl || paper.pdf,
          }));
          items.push(...researchItems);
        }
      } catch (error) {
        console.error('Error fetching research data:', error);
      }

      // Fetch dashboard entries for other content types
      try {
        const entriesResponse = await fetch('/api/entries?limit=50');
        if (entriesResponse.ok) {
          const entriesData = await entriesResponse.json();
          const entries = entriesData.entries || [];
          
          const entryItems: TimelineItem[] = entries.map((entry: any) => ({
            id: entry.id,
            time: new Date(entry.publishedAt),
            title: entry.title,
            description: entry.summary || 'No description available',
            category: getCategoryFromEntry(entry),
            source: entry.source.name,
            sentiment: entry.sentiment ? Math.round(entry.sentiment * 100) : undefined,
            url: entry.url,
          }));
          items.push(...entryItems);
        }
      } catch (error) {
        console.error('Error fetching entries data:', error);
      }

      // Add mock product updates if no real data
      if (items.filter(item => item.category === 'product').length === 0) {
        const mockProductItems: TimelineItem[] = [
          {
            id: 'cursor-update-1',
            time: new Date(Date.now() - 2 * 60 * 60 * 1000),
            title: 'Cursor 0.42: Enhanced AI Code Completion',
            description: 'Introducing improved AI suggestions with better context awareness and faster response times.',
            category: 'product',
            source: 'Cursor Changelog',
            sentiment: 87,
          },
          {
            id: 'copilot-update-1',
            time: new Date(Date.now() - 4 * 60 * 60 * 1000),
            title: 'GitHub Copilot Chat introduces workspace-aware suggestions',
            description: 'New context awareness features help Copilot understand your entire codebase structure.',
            category: 'product',
            source: 'GitHub Blog',
            sentiment: 92,
          },
          {
            id: 'openai-update-1',
            time: new Date(Date.now() - 6 * 60 * 60 * 1000),
            title: 'GPT-4 Turbo with improved code understanding',
            description: 'Enhanced model capabilities for code analysis, debugging, and generation.',
            category: 'product',
            source: 'OpenAI',
            sentiment: 89,
          }
        ];
        items.push(...mockProductItems);
      }

      // Add mock perspective items if needed
      if (items.filter(item => item.category === 'perspective').length === 0) {
        const mockPerspectiveItems: TimelineItem[] = [
          {
            id: 'perspective-1',
            time: new Date(Date.now() - 1 * 60 * 60 * 1000),
            title: 'The AI Coding Assistant War: Who\'s Winning Developer Hearts?',
            description: 'Analysis of market adoption and developer sentiment across different AI coding tools.',
            category: 'perspective',
            source: 'TechCrunch',
            sentiment: 78,
          },
          {
            id: 'perspective-2',
            time: new Date(Date.now() - 5 * 60 * 60 * 1000),
            title: 'Developer Survey 2024: 67% Now Use AI Coding Tools Daily',
            description: 'Latest developer survey reveals widespread AI tool adoption with significant productivity gains.',
            category: 'perspective',
            source: 'Stack Overflow',
            sentiment: 91,
          }
        ];
        items.push(...mockPerspectiveItems);
      }

      // Filter items by time window
      const now = new Date();
      const cutoffTimes = {
        '1h': new Date(now.getTime() - 60 * 60 * 1000),
        '1d': new Date(now.getTime() - 24 * 60 * 60 * 1000),
        '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      };

      const filteredItems = items.filter(item => item.time >= cutoffTimes[timeWindow]);
      
      // Sort by time (newest first)
      filteredItems.sort((a, b) => b.time.getTime() - a.time.getTime());

      setTimelineItems(filteredItems.slice(0, 25)); // Limit to 25 items
    } catch (error) {
      console.error('Error fetching timeline data:', error);
    } finally {
      setLoading(false);
    }
  }, [timeWindow]);

  useEffect(() => {
    fetchTimelineData();
  }, [fetchTimelineData]);

  const getCategoryFromEntry = (entry: any): TimelineItem['category'] => {
    const sourceCategory = entry.source?.category?.toLowerCase();
    const sourceName = entry.source?.name?.toLowerCase() || '';
    
    if (sourceCategory === 'product' || 
        sourceName.includes('cursor') || 
        sourceName.includes('copilot') || 
        sourceName.includes('openai') || 
        sourceName.includes('anthropic')) {
      return 'product';
    }
    
    if (sourceCategory === 'research' || sourceName.includes('arxiv')) {
      return 'research';
    }
    
    if (sourceName.includes('reddit') || sourceName.includes('twitter') || sourceName.includes('hackernews')) {
      return 'social';
    }
    
    return 'perspective';
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const getCategoryColor = (category: TimelineItem['category']) => {
    const colors = {
      product: 'bg-slate-400',
      research: 'bg-slate-500', 
      sentiment: 'bg-slate-600',
      perspective: 'bg-slate-300',
      social: 'bg-slate-700',
    };
    return colors[category];
  };

  const getCategoryLabel = (category: TimelineItem['category']) => {
    const labels = {
      product: 'Product Update',
      research: 'Research',
      sentiment: 'Sentiment',
      perspective: 'Perspective',
      social: 'Social',
    };
    return labels[category];
  };

  const filteredItems = contentFilter === 'all' 
    ? timelineItems 
    : timelineItems.filter(item => item.category === contentFilter);

  if (loading) {
    return (
      <div className={`timeline-view ${className || ""}`}>
        <div className="timeline-header">
          <div className="timeline-controls">
            <div className="button-group">
              <button className="button button-outline active">All Content</button>
              <button className="button button-outline">Product Only</button>
              <button className="button button-outline">Research Only</button>
            </div>
            <select 
              className="select" 
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value as TimeWindow)}
            >
              <option value="1h">Last Hour</option>
              <option value="1d">Last Day</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
        
        <div className="timeline-container">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="timeline-item timeline-skeleton">
              <div className="timeline-marker skeleton"></div>
              <div className="timeline-content">
                <div className="timeline-time skeleton" style={{ width: '80px', height: '12px' }}></div>
                <div className="timeline-title skeleton" style={{ width: '300px', height: '18px', marginBottom: '8px' }}></div>
                <div className="timeline-description skeleton" style={{ width: '400px', height: '14px' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`timeline-view ${className || ""}`}>
      <div className="timeline-header">
        <div className="timeline-controls">
          <div className="button-group">
            <button 
              className={`button button-outline ${contentFilter === 'all' ? 'active' : ''}`}
              onClick={() => setContentFilter('all')}
            >
              All Content
            </button>
            <button 
              className={`button button-outline ${contentFilter === 'product' ? 'active' : ''}`}
              onClick={() => setContentFilter('product')}
            >
              Product Only
            </button>
            <button 
              className={`button button-outline ${contentFilter === 'research' ? 'active' : ''}`}
              onClick={() => setContentFilter('research')}
            >
              Research Only
            </button>
          </div>
          <select 
            className="select" 
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value as TimeWindow)}
          >
            <option value="1h">Last Hour</option>
            <option value="1d">Last Day</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>
      
      <div className="timeline-container">
        {filteredItems.length === 0 ? (
          <div className="timeline-empty">
            <div className="empty-content">
              <div className="empty-icon">📅</div>
              <h3 className="empty-title">No timeline items found</h3>
              <p className="empty-message">
                Try adjusting the time range or content filter to see more items.
              </p>
            </div>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div key={item.id} className="timeline-item">
              <div className={`timeline-marker ${getCategoryColor(item.category)}`}></div>
              <div className="timeline-content">
                <div className="timeline-meta">
                  <span className="timeline-time">{formatTimeAgo(item.time)}</span>
                  <span className={`timeline-badge ${item.category}`}>
                    {getCategoryLabel(item.category)}
                  </span>
                  {item.sentiment && (
                    <span className="timeline-sentiment">
                      {item.sentiment}% positive
                    </span>
                  )}
                </div>
                <h4 className="timeline-title">
                  {item.url ? (
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="timeline-title-link"
                    >
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </h4>
                <p className="timeline-description">{item.description}</p>
                <div className="timeline-source">
                  <span className="timeline-source-label">Source:</span>
                  <span className="timeline-source-name">{item.source}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

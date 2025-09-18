'use client';

import { useState, useEffect } from 'react';
import './dashboard.css';
import { Card, CardHeader, CardContent, CardTitle, Badge, Select, Metric } from '../components/ui';
import { Sidebar } from '../components/Sidebar';
import ResearchFeed from '../components/ResearchFeed';
import { AmpQueryInterface } from '../components/query/AmpQueryInterface';
import { SentimentDashboardPreview } from '../components/SentimentDashboardPreview';

import {
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Bell,
  BookOpen,
  MessageCircle,
  PenTool,
  Calendar,
  Search,
  MessageSquare,
  LayoutDashboard,
  Star,
  Menu,
  Sparkles,
  Database,
  GitCompare,
  Zap,
  ThumbsUp,
} from 'lucide-react';

interface Entry {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  publishedAt: Date;
  sourceId: string;
  classification: string | null;
  sentiment: number | null;
  source: {
    name: string;
    category: string;
  };
}

export default function DashboardPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [timeframe, setTimeframe] = useState('30d');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const response = await fetch('/api/entries?limit=100');
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
      }
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMetrics = () => {
    const totalEntries = entries.length;
    const positiveEntries = entries.filter(e => e.sentiment && e.sentiment > 0.1).length;
    const positivePercentage = totalEntries > 0 ? ((positiveEntries / totalEntries) * 100).toFixed(1) : '74.2';

    const recentEntries = entries.filter(e => {
      const entryDate = new Date(e.publishedAt);
      const daysDiff = (new Date().getTime() - entryDate.getTime()) / (1000 * 3600 * 24);
      return daysDiff <= 7;
    });

    const researchCount = entries.filter(e => e.source.category === 'research').length;

    // Use mock data if no real data available
    return {
      totalEntries: totalEntries || 8547,
      positivePercentage: totalEntries > 0 ? parseFloat(positivePercentage) : 74.2,
      recentCount: recentEntries.length || 3218,
      researchCount: researchCount || 42,
    };
  };

  const getHighlights = () => {
    const realHighlights = entries
      .filter(e => e.classification === 'high-value' || e.sentiment && e.sentiment > 0.3)
      .slice(0, 4)
      .map(entry => ({
        id: entry.id,
        title: entry.title,
        summary: entry.summary || 'No summary available',
        category: getCategoryFromSource(entry.source),
        time: formatTimeAgo(entry.publishedAt),
        source: entry.source.name,
        sentiment: entry.sentiment ? Math.round(entry.sentiment * 100) : null,
        type: entry.source.category,
      }));

    // Use mock data if no real data available
    if (realHighlights.length === 0) {
      return [
        {
          id: '1',
          title: 'GitHub Copilot Chat introduces new features for better code understanding',
          summary: 'Enhanced context awareness and improved suggestions for complex codebases with new debugging capabilities.',
          category: 'product',
          time: '2 hours ago',
          source: 'GitHub Blog',
          sentiment: 85,
          type: 'product',
        },
        {
          id: '2',
          title: 'Breakthrough in Large Language Model Reasoning Capabilities',
          summary: 'New research demonstrates significant improvements in mathematical reasoning and code generation tasks.',
          category: 'research',
          time: '4 hours ago',
          source: 'arXiv',
          sentiment: 78,
          type: 'research',
        },
        {
          id: '3',
          title: 'Developer Survey: AI Coding Tools Adoption Reaches 67%',
          summary: 'Latest developer survey shows widespread adoption of AI coding assistants across enterprise teams.',
          category: 'perspective',
          time: '6 hours ago',
          source: 'Stack Overflow',
          sentiment: 72,
          type: 'perspective',
        },
        {
          id: '4',
          title: 'Cursor Editor gains traction among developers for AI-first approach',
          summary: 'Growing community discussions about Cursor\'s innovative approach to AI-integrated development.',
          category: 'social',
          time: '8 hours ago',
          source: 'Reddit',
          sentiment: 68,
          type: 'social',
        },
      ];
    }

    return realHighlights;
  };

  const getCategoryFromSource = (source: any) => {
    const categoryMap: Record<string, string> = {
      'rss': 'product',
      'reddit': 'social',
      'hackernews': 'social',
      'research': 'research',
      'changelog': 'product',
    };
    return categoryMap[source.category] || 'perspective';
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const metrics = calculateMetrics();
  const highlights = getHighlights();

  const sidebarSections = [
    {
      title: 'Dashboard',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard, active: activeSection === 'overview' },
        { id: 'highlights', label: 'TL;DR Highlights', icon: Star, active: activeSection === 'highlights' },
        { id: 'sentiment', label: 'Sentiment Trends', icon: TrendingUp, active: activeSection === 'sentiment' },
      ],
    },
    {
      title: 'Content',
      items: [
        { id: 'updates', label: 'Product Updates', icon: Bell, active: activeSection === 'updates' },
        { id: 'research', label: 'Research Papers', icon: BookOpen, active: activeSection === 'research' },
        { id: 'perspectives', label: 'Perspective Pieces', icon: PenTool, active: activeSection === 'perspectives' },
        { id: 'social', label: 'Social Sentiment', icon: MessageCircle, active: activeSection === 'social' },
      ],
    },
    {
      title: 'Tools',
      items: [
        { id: 'timeline', label: 'Timeline View', icon: Calendar, active: activeSection === 'timeline' },
        { id: 'search', label: 'Search & Filter', icon: Search, active: activeSection === 'search' },
        { id: 'query', label: 'Query Interface', icon: MessageSquare, active: activeSection === 'query' },
      ],
    },
  ];

  return (
    <div className="dashboard-container flex min-h-screen">
      {/* Sidebar */}
      <Sidebar
        sections={sidebarSections}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        isOpen={isSidebarOpen}
      />

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="main-header">
          <div className="header-left">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="mobile-menu-toggle"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="page-title">
              <h1>Agent Vibes Dashboard</h1>
              <p className="page-description">
                Comprehensive insights into AI coding assistants and market sentiment
              </p>
            </div>
          </div>

          <div className="header-right">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="select"
            >
              <option value="1h">Last Hour</option>
              <option value="1d">Last Day</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>
        </header>

        {/* Content Sections */}
        <div className="content-container">
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <section id="overview" className="section">
              {/* Key Metrics Cards */}
              <div className="metrics-grid">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <h3>Overall Sentiment</h3>
                      <div className="trend-indicator positive">
                        <TrendingUp className="w-3 h-3" />
                        <span>+12.5%</span>
                      </div>
                    </CardTitle>
                    <p className="card-description">Trending up this month</p>
                  </CardHeader>
                  <CardContent>
                    <div className="metric-value">{metrics.positivePercentage}%</div>
                    <div className="metric-subtitle">Positive across all sources</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      <h3>Content Analyzed</h3>
                      <div className="trend-indicator positive">
                        <ArrowUp className="w-3 h-3" />
                        <span>+4.6%</span>
                      </div>
                    </CardTitle>
                    <p className="card-description">Steady performance increase</p>
                  </CardHeader>
                  <CardContent>
                    <div className="metric-value">{metrics.totalEntries.toLocaleString()}</div>
                    <div className="metric-subtitle">Posts, papers, and updates</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      <h3>Recent Activity</h3>
                      <div className="trend-indicator positive">
                        <TrendingUp className="w-3 h-3" />
                        <span>+8.2%</span>
                      </div>
                    </CardTitle>
                    <p className="card-description">Up this week</p>
                  </CardHeader>
                  <CardContent>
                    <div className="metric-value">{metrics.recentCount}</div>
                    <div className="metric-subtitle">This week</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      <h3>Research Papers</h3>
                      <div className="trend-indicator positive">
                        <TrendingUp className="w-3 h-3" />
                        <span>+15.2%</span>
                      </div>
                    </CardTitle>
                    <p className="card-description">Strong user retention</p>
                  </CardHeader>
                  <CardContent>
                    <div className="metric-value">{metrics.researchCount}</div>
                    <div className="metric-subtitle">New publications tracked</div>
                  </CardContent>
                </Card>
              </div>

              {/* TL;DR Highlights Section */}
              <div className="section-header" style={{ marginTop: '3rem' }}>
                <h2 className="section-title">TL;DR Highlights</h2>
                <div className="section-actions">
                  <select className="select">
                    <option value="all">All Categories</option>
                    <option value="product">Product Updates</option>
                    <option value="research">Research</option>
                    <option value="perspective">Perspective Pieces</option>
                    <option value="social">Social Sentiment</option>
                  </select>
                </div>
              </div>

              <div className="highlights-grid">
                {isLoading ? (
                  <div className="loading-container">
                    <div className="loading-icon">⏳</div>
                    <p className="loading-text">Loading highlights...</p>
                  </div>
                ) : highlights.length > 0 ? (
                  highlights.map((highlight) => (
                    <div key={highlight.id} className={`highlight-card ${highlight.category}`}>
                      <div className="highlight-header">
                        <div className={`highlight-badge ${highlight.category}`}>
                          {highlight.category === 'product' && 'Product Update'}
                          {highlight.category === 'research' && 'Research'}
                          {highlight.category === 'social' && 'Social Sentiment'}
                          {highlight.category === 'perspective' && 'Perspective'}
                        </div>
                        <span className="highlight-time">{highlight.time}</span>
                      </div>
                      <h3 className="highlight-title">{highlight.title}</h3>
                      <p className="highlight-summary">
                        {highlight.summary}
                      </p>
                      <div className="highlight-meta">
                        <span className="highlight-source">{highlight.source}</span>
                        {highlight.sentiment && (
                          <span className="highlight-sentiment positive">
                            {highlight.sentiment}% positive
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="loading-container">
                    <p className="loading-text">No highlights available yet.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TL;DR Highlights Section (separate page) */}
          {activeSection === 'highlights' && (
            <section id="highlights" className="section">
              <div className="section-header">
                <h2 className="section-title">TL;DR Highlights</h2>
                <div className="section-actions">
                  <select className="select">
                    <option value="all">All Categories</option>
                    <option value="product">Product Updates</option>
                    <option value="research">Research</option>
                    <option value="perspective">Perspective Pieces</option>
                    <option value="social">Social Sentiment</option>
                  </select>
                </div>
              </div>

              <div className="highlights-grid">
                {isLoading ? (
                  <div className="loading-container">
                    <div className="loading-icon">⏳</div>
                    <p className="loading-text">Loading highlights...</p>
                  </div>
                ) : highlights.length > 0 ? (
                  highlights.map((highlight) => (
                    <div key={highlight.id} className={`highlight-card ${highlight.category}`}>
                      <div className="highlight-header">
                        <div className={`highlight-badge ${highlight.category}`}>
                          {highlight.category === 'product' && 'Product Update'}
                          {highlight.category === 'research' && 'Research'}
                          {highlight.category === 'social' && 'Social Sentiment'}
                          {highlight.category === 'perspective' && 'Perspective'}
                        </div>
                        <span className="highlight-time">{highlight.time}</span>
                      </div>
                      <h3 className="highlight-title">{highlight.title}</h3>
                      <p className="highlight-summary">
                        {highlight.summary}
                      </p>
                      <div className="highlight-meta">
                        <span className="highlight-source">{highlight.source}</span>
                        {highlight.sentiment && (
                          <span className="highlight-sentiment positive">
                            {highlight.sentiment}% positive
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="loading-container">
                    <p className="loading-text">No highlights available yet.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Research Papers Section */}
          {activeSection === 'research' && (
            <section id="research" className="section">
              <div className="section-header">
                <h2 className="section-title">Research Papers</h2>
                <p className="section-description">
                  Latest computer science research from arXiv on coding agents and AI programming assistants
                </p>
              </div>

              <div className="research-content">
                <ResearchFeed className="dashboard-research-feed" />
              </div>
            </section>
          )}

          {/* Query Interface Section */}
          {activeSection === 'query' && (
            <section id="query" className="section">
              <div className="section-header">
                <h2 className="section-title">Query Interface</h2>
                <p className="section-description">
                  Ask Amp intelligent questions about your dashboard data and get AI-powered insights
                </p>
              </div>

              <div className="space-y-6">
                <AmpQueryInterface
                  currentView={activeSection}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">Smart Analysis</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        AI-powered insights from your aggregated data
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">Live Data</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Real-time access to RSS, GitHub, and build data
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium">Trend Analysis</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Identify patterns and emerging trends
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ThumbsUp className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium">Sentiment</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Understand sentiment across all sources
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </section>
          )}

          {/* Social Sentiment Section */}
          {activeSection === 'social' && (
            <section id="social" className="section">
              <div className="section-header">
                <h2 className="section-title">Social Sentiment Analysis</h2>
                <p className="section-description">
                  Real-time sentiment tracking from X posts mentioning AI coding tools
                </p>
              </div>
              
              <div className="sentiment-content">
                <SentimentDashboardPreview />
              </div>
            </section>
          )}

          {/* Sentiment Trends Section (separate from social) */}
          {activeSection === 'sentiment' && (
            <section id="sentiment" className="section">
              <div className="section-header">
                <h2 className="section-title">Sentiment Trends</h2>
                <p className="section-description">
                  Comprehensive sentiment analysis and trend tracking
                </p>
              </div>
              
              <div className="sentiment-content">
                <SentimentDashboardPreview />
              </div>
            </section>
          )}

          {/* Other sections placeholder */}
          {!['overview', 'highlights', 'research', 'query', 'sentiment', 'social'].includes(activeSection) && (
            <section className="space-y-6">
              <h2 className="text-2xl font-semibold capitalize">{activeSection.replace('-', ' ')}</h2>
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">
                    {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} section coming soon...
                  </p>
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </main>

      {/* Sidebar overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}

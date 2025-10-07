'use client';

import { useState } from 'react';
import './dashboard.css';
import SocialSentiment from './components/SocialSentiment';
import RssSection from './components/RssSection';

export default function DashboardV2Page() {
  const [timeframe, setTimeframe] = useState(30);
  const [highlightFilter, setHighlightFilter] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon">AV</div>
            <span className="brand-text">Agent Vibes</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Dashboard</div>
            <a href="#overview" className="nav-item active">
              <span>Overview</span>
            </a>
            <a href="#highlights" className="nav-item">
              <span>TL;DR Highlights</span>
            </a>
            <a href="#sentiment" className="nav-item">
              <span>Sentiment Trends</span>
            </a>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Content</div>
            <a href="#updates" className="nav-item">
              <span>Product Updates</span>
            </a>
            <a href="#research" className="nav-item">
              <span>Research Papers</span>
            </a>
            <a href="#perspectives" className="nav-item">
              <span>Perspective Pieces</span>
            </a>
            <a href="#social" className="nav-item">
              <span>Social Sentiment</span>
            </a>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Tools</div>
            <a href="#timeline" className="nav-item">
              <span>Timeline View</span>
            </a>
            <a href="#search" className="nav-item">
              <span>Search & Filter</span>
            </a>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="main-header">
          <div className="header-left">
            <button
              className="mobile-menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              Menu
            </button>
            <div className="page-title">
              <h1>Agent Vibes Dashboard</h1>
              <p className="page-description">
                Comprehensive insights into AI coding assistants and market sentiment
              </p>
            </div>
          </div>
          <div className="header-right">
            <div className="search-bar">
              <input type="text" placeholder="Search content..." />
            </div>
            <select
              className="select"
              value={timeframe}
              onChange={(e) => setTimeframe(Number(e.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </header>

        {/* Content Sections */}
        <div className="content-container">
          {/* Overview Section */}
          <section id="overview" className="section">
            <div className="metrics-grid">
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <h3>Overall Sentiment</h3>
                    <div className="trend-indicator positive">
                      <span>+12.5%</span>
                    </div>
                  </div>
                  <p className="card-description">Trending up this month</p>
                </div>
                <div className="card-content">
                  <div className="metric-value">74.2%</div>
                  <div className="metric-subtitle">Positive across all sources</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <h3>Content Analyzed</h3>
                    <div className="trend-indicator positive">
                      <span>+4.6%</span>
                    </div>
                  </div>
                  <p className="card-description">Steady performance increase</p>
                </div>
                <div className="card-content">
                  <div className="metric-value">8,547</div>
                  <div className="metric-subtitle">Posts, papers, and updates</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <h3>Active Discussions</h3>
                    <div className="trend-indicator negative">
                      <span>-2%</span>
                    </div>
                  </div>
                  <p className="card-description">Down 2% this period</p>
                </div>
                <div className="card-content">
                  <div className="metric-value">3,218</div>
                  <div className="metric-subtitle">Across social platforms</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <h3>Research Papers</h3>
                    <div className="trend-indicator positive">
                      <span>+15.2%</span>
                    </div>
                  </div>
                  <p className="card-description">Strong publication rate</p>
                </div>
                <div className="card-content">
                  <div className="metric-value">42</div>
                  <div className="metric-subtitle">New publications this month</div>
                </div>
              </div>
            </div>
          </section>

          {/* TL;DR Highlights Section */}
          <section id="highlights" className="section">
            <div className="section-header">
              <h2 className="section-title">TL;DR Highlights</h2>
              <div className="section-actions">
                <select
                  className="select"
                  value={highlightFilter}
                  onChange={(e) => setHighlightFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  <option value="product">Product Updates</option>
                  <option value="research">Research</option>
                  <option value="perspective">Perspective Pieces</option>
                  <option value="social">Social Sentiment</option>
                </select>
              </div>
            </div>

            <div className="highlights-grid">
              <div className="highlight-card product">
                <div className="highlight-header">
                  <div className="highlight-badge product">Product Update</div>
                  <span className="highlight-time">2 hours ago</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Cursor releases Composer with multi-file editing
                </h3>
                <p className="text-sm text-gray-400 mb-3">
                  Cursor's new Composer feature enables seamless multi-file code generation
                  and refactoring with improved context awareness across your entire
                  codebase.
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Cursor Blog</span>
                  <a href="#" className="text-blue-400 hover:text-blue-300">
                    Read more →
                  </a>
                </div>
              </div>

              <div className="highlight-card research">
                <div className="highlight-header">
                  <div className="highlight-badge research">Research</div>
                  <span className="highlight-time">5 hours ago</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  New paper on AI-assisted code review effectiveness
                </h3>
                <p className="text-sm text-gray-400 mb-3">
                  Study finds AI code assistants reduce review time by 40% while
                  maintaining code quality standards in large enterprise codebases.
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>arXiv</span>
                  <a href="#" className="text-blue-400 hover:text-blue-300">
                    Read more →
                  </a>
                </div>
              </div>

              <div className="highlight-card perspective">
                <div className="highlight-header">
                  <div className="highlight-badge perspective">Perspective</div>
                  <span className="highlight-time">1 day ago</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  The future of pair programming: Human + AI
                </h3>
                <p className="text-sm text-gray-400 mb-3">
                  Industry leaders discuss how AI coding assistants are reshaping developer
                  workflows and team collaboration patterns.
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Tech Crunch</span>
                  <a href="#" className="text-blue-400 hover:text-blue-300">
                    Read more →
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-400">
                <strong>Note:</strong> Product Updates, Research, and Perspectives will
                be powered by Miniflux RSS + AI summaries.{' '}
                <a
                  href="https://github.com/sourcegraph-community/agent-vibes/blob/main/docs/miniflux-integration.md"
                  className="text-blue-400 hover:text-blue-300"
                >
                  View integration guide →
                </a>
              </p>
            </div>
          </section>

          {/* Social Sentiment Section - Connected to Real Data */}
          <SocialSentiment timeframe={timeframe} />

          {/* Product Updates Section */}
          <RssSection
            id="updates"
            title="Product Updates"
            category="product"
            limit={6}
            showLoadMore
          />

          {/* Research Papers Section */}
          <RssSection
            id="research"
            title="Research Papers"
            category="research"
            limit={6}
            showLoadMore
          />

          {/* Perspectives Section */}
          <RssSection
            id="perspectives"
            title="Perspective Pieces"
            category="perspective"
            limit={6}
            showLoadMore
          />

          {/* Timeline View Placeholder */}
          <section id="timeline" className="section">
            <div className="section-header">
              <h2 className="section-title">Timeline View</h2>
            </div>
            <div className="card">
              <p className="text-gray-400">
                Unified timeline view combining all content types chronologically.
                <br />
                Coming soon...
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

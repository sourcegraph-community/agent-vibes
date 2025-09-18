import path from "node:path";
import { promises as fs } from "node:fs";

import Script from "next/script";
import type { Metadata } from "next";

import "@/mocks/analytics-dashboard/analytics-dashboard.css";

export const metadata: Metadata = {
  title: "Agent Intelligence Dashboard | Agent Vibes",
  description: "Dark-mode intelligence dashboard hydrated from mock analytics fixtures.",
};

export const dynamic = "force-dynamic";

const DATA_ROOT = path.join(process.cwd(), "mocks", "analytics-dashboard", "data");

type TrendDirection = "positive" | "negative" | "neutral";

type DashboardMeta = {
  title: string;
  description: string;
  timeframes: string[];
  defaultTimeframe: string;
  lastUpdated: string;
};

type Metric = {
  id: string;
  title: string;
  description: string;
  value: number;
  unit?: string;
  trend: {
    direction: TrendDirection;
    label: string;
  };
  subtitle: string;
};

type Highlight = {
  id: string;
  category: string;
  badge: string;
  time: string;
  title: string;
  summary: string;
  meta: Record<string, string | number>;
};

type SentimentDataset = {
  positive: number[];
  neutral: number[];
  negative: number[];
};

type SentimentTimeframe = {
  labels: string[];
  datasets: Record<string, SentimentDataset>;
};

type SentimentData = {
  defaultView: string;
  defaultTimeframe: string;
  agents: string[];
  sources: string[];
  trends: Record<string, SentimentTimeframe>;
  shareOfVoice: Record<string, { labels: string[]; datasets: Record<string, number[]> }>;
  summary: Array<{ label: string; value: string; state?: TrendDirection }>;
};

type ProductUpdate = {
  agent: string;
  time: string;
  title: string;
  summary: string;
  tag: string;
  sentiment: string;
};

type ResearchItem = {
  source: string;
  time: string;
  title: string;
  summary: string;
  tag: string;
  impact: string;
};

type PerspectiveItem = {
  source: string;
  time: string;
  title: string;
  summary: string;
  tag: string;
  author: string;
};

type SocialItem = {
  source: string;
  time: string;
  title: string;
  summary: string;
  tag: string;
  engagement: string;
};

type DashboardFeeds = {
  productUpdates: ProductUpdate[];
  research: ResearchItem[];
  perspectives: PerspectiveItem[];
  social: SocialItem[];
};

type DashboardData = {
  meta: DashboardMeta;
  overview: {
    metrics: Metric[];
    highlights: Highlight[];
  };
  sentiment: SentimentData;
  feeds: DashboardFeeds;
};

async function loadDashboardData(): Promise<DashboardData> {
  const raw = await fs.readFile(path.join(DATA_ROOT, "dashboard.json"), "utf8");
  return JSON.parse(raw) as DashboardData;
}

const numberFormatter = new Intl.NumberFormat("en-US");

function formatMetricValue(value: number, unit?: string): string {
  if (Number.isNaN(value)) {
    return unit ? `— ${unit}` : "—";
  }

  const formatted = numberFormatter.format(value);
  if (!unit) {
    return formatted;
  }

  if (unit === "%") {
    return `${formatted}${unit}`;
  }

  return `${formatted} ${unit}`;
}

function formatLastUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getTrendClass(direction: TrendDirection): string {
  switch (direction) {
    case "positive":
      return "positive";
    case "negative":
      return "negative";
    default:
      return "neutral";
  }
}

const agentDisplayNames: Record<string, string> = {
  amp: "Amp",
  cursor: "Cursor",
  "github-copilot": "GitHub Copilot",
  "claude-code": "Claude Code",
  windsurf: "Windsurf",
};

function getAgentName(agent: string): string {
  return agentDisplayNames[agent] ?? agent.replace(/(^|[-_])([a-z])/g, (match) => match.slice(-1).toUpperCase());
}

function getHighlightClass(category: string): string {
  return category.toLowerCase();
}

function getSentimentIcon(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("positive")) {
    return "thumbs-up";
  }
  if (normalized.includes("trending")) {
    return "trending-up";
  }
  if (normalized.includes("mixed")) {
    return "message-circle";
  }
  return "sparkles";
}

function toSentimentPayload(timeframe?: SentimentTimeframe): string | null {
  if (!timeframe) {
    return null;
  }

  const payload = JSON.stringify(timeframe).replace(/</g, "\\u003c");
  return payload;
}

export default async function AnalyticsDashboardPage() {
  const data = await loadDashboardData();
  const sentimentTimeframe = data.sentiment.trends[data.sentiment.defaultTimeframe] ??
    Object.values(data.sentiment.trends)[0];
  const sentimentPayload = toSentimentPayload(sentimentTimeframe);

  return (
    <>
      <aside className="sidebar">
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
              <i data-lucide="layout-dashboard" />
              <span>Overview</span>
            </a>
            <a href="#highlights" className="nav-item">
              <i data-lucide="star" />
              <span>TL;DR Highlights</span>
            </a>
            <a href="#sentiment" className="nav-item">
              <i data-lucide="trending-up" />
              <span>Sentiment Trends</span>
            </a>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Content</div>
            <a href="#updates" className="nav-item">
              <i data-lucide="bell" />
              <span>Product Updates</span>
            </a>
            <a href="#research" className="nav-item">
              <i data-lucide="book-open" />
              <span>Research Papers</span>
            </a>
            <a href="#perspectives" className="nav-item">
              <i data-lucide="pen-tool" />
              <span>Perspective Pieces</span>
            </a>
            <a href="#social" className="nav-item">
              <i data-lucide="message-circle" />
              <span>Social Sentiment</span>
            </a>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <div className="header-left">
            <button className="mobile-menu-toggle" id="mobileMenuToggle">
              <i data-lucide="menu" />
            </button>
            <div className="page-title">
              <h1>{data.meta.title}</h1>
              <p className="page-description">{data.meta.description}</p>
            </div>
          </div>
          <div className="header-right">
            <div className="search-bar">
              <i data-lucide="search" />
              <input type="text" placeholder="Search content..." id="globalSearch" />
            </div>
            <select className="select" id="timeframeFilter" defaultValue={data.meta.defaultTimeframe}>
              {data.meta.timeframes.map((timeframe) => (
                <option key={timeframe} value={timeframe}>
                  {timeframe}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="content-container">
          <section id="overview" className="section">
            <div className="metrics-grid">
              {data.overview.metrics.map((metric) => (
                <div key={metric.id} className="card">
                  <div className="card-header">
                    <div className="card-title">
                      <h3>{metric.title}</h3>
                      <div className={`trend-indicator ${getTrendClass(metric.trend.direction)}`}>
                        <i data-lucide={metric.trend.direction === "positive" ? "trending-up" : metric.trend.direction === "negative" ? "trending-down" : "activity"} />
                        <span>{metric.trend.label}</span>
                      </div>
                    </div>
                    <p className="card-description">{metric.description}</p>
                  </div>
                  <div className="card-content">
                    <div className="metric-value">{formatMetricValue(metric.value, metric.unit)}</div>
                    <div className="metric-subtitle">{metric.subtitle}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="highlights" className="section">
            <div className="section-header">
              <h2 className="section-title">TL;DR Highlights</h2>
              <div className="section-actions">
                <select className="select" id="highlightFilter">
                  <option value="all">All Categories</option>
                  <option value="product">Product Updates</option>
                  <option value="research">Research</option>
                  <option value="perspective">Perspective Pieces</option>
                  <option value="social">Social Sentiment</option>
                </select>
              </div>
            </div>

            <div className="highlights-grid">
              {data.overview.highlights.map((highlight) => (
                <div
                  key={highlight.id}
                  className={`highlight-card ${getHighlightClass(highlight.category)}`}
                  data-category={highlight.category}
                >
                  <div className="highlight-header">
                    <div className={`highlight-badge ${getHighlightClass(highlight.category)}`}>
                      {highlight.badge}
                    </div>
                    <span className="highlight-time">{highlight.time}</span>
                  </div>
                  <h3 className="highlight-title">{highlight.title}</h3>
                  <p className="highlight-summary">{highlight.summary}</p>
                  <div className="highlight-meta">
                    {Object.entries(highlight.meta).map(([key, value]) => (
                      <span key={key} className={`highlight-${key}`}>
                        {typeof value === "number" && key === "sentiment" ? `${value}% positive` : value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="sentiment" className="section">
            <div className="section-header">
              <h2 className="section-title">Sentiment Trends</h2>
              <div className="section-actions">
                <div className="button-group" id="chartViewToggle">
                  <button className="button button-outline active" data-view="sentiment">
                    Sentiment
                  </button>
                  <button className="button button-outline" data-view="share-of-voice">
                    Share of Voice
                  </button>
                </div>
                <div className="button-group">
                  {data.meta.timeframes.map((timeframe) => (
                    <button
                      key={timeframe}
                      className={`button button-outline${timeframe === data.sentiment.defaultTimeframe ? " active" : ""}`}
                      data-period={timeframe}
                    >
                      {timeframe === "1h"
                        ? "Last Hour"
                        : timeframe === "1d"
                        ? "Last Day"
                        : timeframe === "7d"
                        ? "Last 7 days"
                        : timeframe === "30d"
                        ? "Last 30 days"
                        : timeframe === "90d"
                        ? "Last 90 days"
                        : timeframe === "1y"
                        ? "Last year"
                        : timeframe}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="filter-bar">
              <div className="filter-group">
                <label className="filter-label">AI Agents:</label>
                <div className="checkbox-group">
                  {data.sentiment.agents.map((agent, index) => (
                    <label className="checkbox-item" key={agent}>
                      <input type="checkbox" name="agents" value={agent} defaultChecked={index < 2} />
                      <span className="checkbox-label">{getAgentName(agent)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <label className="filter-label">Sources:</label>
                <div className="checkbox-group">
                  {data.sentiment.sources.map((source, index) => (
                    <label className="checkbox-item" key={source}>
                      <input type="checkbox" name="sources" value={source} defaultChecked={index < 2} />
                      <span className="checkbox-label">{source === "x" ? "X (Twitter)" : source.charAt(0).toUpperCase() + source.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-content">
                <div className="chart-container">
                  <canvas id="sentimentChart" />
                </div>
              </div>
            </div>

            <div className="stats-summary">
              <div className="stats-grid">
                {data.sentiment.summary.map((item) => (
                  <div key={item.label} className="stat-card">
                    <div className="stat-label">{item.label}</div>
                    <div className={`stat-value${item.state ? ` ${item.state}` : ""}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="updates" className="section">
            <div className="section-header">
              <h2 className="section-title">Product Updates</h2>
              <div className="section-actions">
                <select className="select" id="agentFilter">
                  <option value="all">All Agents</option>
                  {data.sentiment.agents.map((agent) => (
                    <option key={agent} value={agent}>
                      {getAgentName(agent)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="content-feed">
              {data.feeds.productUpdates.map((item) => (
                <div key={`${item.agent}-${item.title}`} className="content-item" data-agent={item.agent} data-type="product">
                  <div className="content-header">
                    <div className={`agent-badge ${item.agent}`}>{getAgentName(item.agent)}</div>
                    <span className="content-time">{item.time}</span>
                  </div>
                  <h3 className="content-title">{item.title}</h3>
                  <p className="content-summary">{item.summary}</p>
                  <div className="content-meta">
                    <span className="content-tag product">{item.tag}</span>
                    <span className="content-engagement">
                      <i data-lucide={getSentimentIcon(item.sentiment)} />
                      <span>{item.sentiment}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="research" className="section">
            <div className="section-header">
              <h2 className="section-title">Research Papers</h2>
              <div className="section-actions">
                <select className="select" id="researchFilter">
                  <option value="all">All Research</option>
                  <option value="academic">Academic Papers</option>
                  <option value="industry">Industry Reports</option>
                </select>
              </div>
            </div>

            <div className="content-feed">
              {data.feeds.research.map((item) => (
                <div key={`${item.source}-${item.title}`} className="content-item" data-type={item.tag === "Academic Paper" ? "academic" : "industry"}>
                  <div className="content-header">
                    <div className={`source-badge ${item.tag === "Academic Paper" ? "academic" : "industry"}`}>
                      <i data-lucide={item.tag === "Academic Paper" ? "book-open" : "building"} />
                      <span>{item.source}</span>
                    </div>
                    <span className="content-time">{item.time}</span>
                  </div>
                  <h3 className="content-title">{item.title}</h3>
                  <p className="content-summary">{item.summary}</p>
                  <div className="content-meta">
                    <span className={`content-tag ${item.tag === "Academic Paper" ? "academic" : "industry"}`}>{item.tag}</span>
                    <span className={`content-impact ${item.impact.toLowerCase().includes("high") ? "high" : "medium"}`}>
                      {item.impact}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="perspectives" className="section">
            <div className="section-header">
              <h2 className="section-title">Perspective Pieces</h2>
              <div className="section-actions">
                <select className="select" id="perspectiveFilter">
                  <option value="all">All Sources</option>
                  <option value="medium">Medium</option>
                  <option value="substack">Substack</option>
                  <option value="blog">Tech Blogs</option>
                </select>
              </div>
            </div>

            <div className="content-feed">
              {data.feeds.perspectives.map((item) => (
                <div key={`${item.source}-${item.title}`} className="content-item" data-source={item.source.toLowerCase()}>
                  <div className="content-header">
                    <div className="source-badge blog">
                      <i data-lucide="pen-tool" />
                      <span>{item.source}</span>
                    </div>
                    <span className="content-time">{item.time}</span>
                  </div>
                  <h3 className="content-title">{item.title}</h3>
                  <p className="content-summary">{item.summary}</p>
                  <div className="content-meta">
                    <span className="content-tag perspective">{item.tag}</span>
                    <span className="content-author">{item.author}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="social" className="section">
            <div className="section-header">
              <h2 className="section-title">Social Sentiment</h2>
              <div className="section-actions">
                <select className="select" id="socialFilter">
                  <option value="all">All Sources</option>
                  <option value="reddit">Reddit</option>
                  <option value="x">X (Twitter)</option>
                  <option value="hackernews">Hacker News</option>
                </select>
              </div>
            </div>

            <div className="content-feed">
              {data.feeds.social.map((item) => (
                <div key={`${item.source}-${item.title}`} className="content-item" data-source={item.source.toLowerCase()}>
                  <div className="content-header">
                    <div className="source-badge reddit">
                      <i data-lucide="message-circle" />
                      <span>{item.source}</span>
                    </div>
                    <span className="content-time">{item.time}</span>
                  </div>
                  <h3 className="content-title">{item.title}</h3>
                  <p className="content-summary">{item.summary}</p>
                  <div className="content-meta">
                    <span className="content-tag discussion">{item.tag}</span>
                    <span className="content-engagement">{item.engagement}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {sentimentPayload ? (
        <script id="sentiment-chart-data" type="application/json">
          {sentimentPayload}
        </script>
      ) : null}

      <Script src="https://cdn.jsdelivr.net/npm/chart.js" strategy="afterInteractive" />
      <Script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" strategy="afterInteractive" />
      <Script id="analytics-dashboard-init" strategy="afterInteractive">
        {`
          (function() {
            function initIcons() {
              if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
              }
            }

            function initChart() {
              const ctx = document.getElementById('sentimentChart');
              const dataElement = document.getElementById('sentiment-chart-data');
              if (!ctx || !dataElement || !window.Chart) {
                return;
              }

              try {
                const payload = JSON.parse(dataElement.textContent || '{}');
                const colors = {
                  'amp': { positive: 'hsl(0, 0%, 90%)', negative: 'hsl(0, 0%, 70%)' },
                  'cursor': { positive: 'hsl(0, 0%, 80%)', negative: 'hsl(0, 0%, 60%)' },
                  'github-copilot': { positive: 'hsl(0, 0%, 70%)', negative: 'hsl(0, 0%, 50%)' },
                  'claude-code': { positive: 'hsl(0, 0%, 60%)', negative: 'hsl(0, 0%, 40%)' },
                  'windsurf': { positive: 'hsl(0, 0%, 50%)', negative: 'hsl(0, 0%, 30%)' }
                };

                const datasets = [];
                Object.entries(payload.datasets || {}).forEach(([agent, sentiment]) => {
                  const color = colors[agent] || { positive: 'hsl(0, 0%, 75%)', negative: 'hsl(0, 0%, 55%)' };
                  datasets.push({
                    label: agent.charAt(0).toUpperCase() + agent.slice(1) + ' Positive',
                    data: sentiment.positive,
                    borderColor: color.positive,
                    backgroundColor: color.positive + '20',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3
                  });
                  datasets.push({
                    label: agent.charAt(0).toUpperCase() + agent.slice(1) + ' Negative',
                    data: sentiment.negative,
                    borderColor: color.negative,
                    backgroundColor: color.negative + '20',
                    fill: false,
                    tension: 0.4,
                    borderDash: [6, 6],
                    pointRadius: 3
                  });
                });

                new window.Chart(ctx, {
                  type: 'line',
                  data: {
                    labels: payload.labels,
                    datasets
                  },
                  options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                        labels: {
                          color: '#e5e7eb',
                          usePointStyle: true,
                          padding: 20
                        }
                      },
                      tooltip: {
                        backgroundColor: '#374151',
                        titleColor: '#e5e7eb',
                        bodyColor: '#e5e7eb',
                        borderColor: '#6b7280',
                        borderWidth: 1
                      }
                    },
                    scales: {
                      x: {
                        ticks: { color: '#9ca3af' },
                        grid: { color: '#374151' }
                      },
                      y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                          color: '#9ca3af',
                          callback: (value) => value + '%'
                        },
                        grid: { color: '#374151' }
                      }
                    },
                    interaction: {
                      intersect: false,
                      mode: 'index'
                    }
                  }
                });
              } catch (error) {
                console.error('Failed to initialise sentiment chart', error);
              }
            }

            initIcons();
            initChart();
          })();
        `}
      </Script>
    </>
  );
}

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

export default async function AnalyticsDashboardPage() {
  const data = await loadDashboardData();
  const analyticsPayload = JSON.stringify({
    meta: data.meta,
    sentiment: data.sentiment,
  }).replace(/</g, "\\u003c");

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

      <script id="analytics-dashboard-data" type="application/json">
        {analyticsPayload}
      </script>

      <Script src="https://cdn.jsdelivr.net/npm/chart.js" strategy="afterInteractive" />
      <Script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" strategy="afterInteractive" />
      <Script id="analytics-dashboard-init" strategy="afterInteractive">
        {`
          (function () {
            function parseDashboardData() {
              var dataElement = document.getElementById('analytics-dashboard-data');
              if (!dataElement) {
                console.warn('Analytics dashboard data element missing');
                return null;
              }
              try {
                return JSON.parse(dataElement.textContent || '{}');
              } catch (error) {
                console.error('Failed to parse analytics dashboard data', error);
                return null;
              }
            }

            var dashboardData = parseDashboardData();
            if (!dashboardData) {
              return;
            }

            var meta = dashboardData.meta || {};
            var sentiment = dashboardData.sentiment || {};
            var trends = sentiment.trends || {};
            var shareOfVoice = sentiment.shareOfVoice || {};
            var defaultTimeframe = sentiment.defaultTimeframe || meta.defaultTimeframe;
            var trendKeys = Object.keys(trends);
            if (!defaultTimeframe && trendKeys.length > 0) {
              defaultTimeframe = trendKeys[0];
            }
            var shareKeys = Object.keys(shareOfVoice);

            var state = {
              timeframe: defaultTimeframe || (shareKeys.length > 0 ? shareKeys[0] : null),
              view: sentiment.defaultView || 'sentiment',
              selectedAgents: new Set()
            };

            var chartInstance = null;
            var iconRetryCount = 0;

            var sentimentColors = {
              amp: { positive: 'hsl(0, 0%, 90%)', negative: 'hsl(0, 0%, 70%)' },
              cursor: { positive: 'hsl(0, 0%, 80%)', negative: 'hsl(0, 0%, 60%)' },
              'github-copilot': { positive: 'hsl(0, 0%, 70%)', negative: 'hsl(0, 0%, 50%)' },
              'claude-code': { positive: 'hsl(0, 0%, 60%)', negative: 'hsl(0, 0%, 40%)' },
              windsurf: { positive: 'hsl(0, 0%, 50%)', negative: 'hsl(0, 0%, 30%)' }
            };

            var voiceColors = {
              amp: 'hsl(0, 0%, 90%)',
              cursor: 'hsl(0, 0%, 80%)',
              'github-copilot': 'hsl(0, 0%, 70%)',
              'claude-code': 'hsl(0, 0%, 60%)',
              windsurf: 'hsl(0, 0%, 50%)'
            };

            function initIcons() {
              if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
              } else if (iconRetryCount < 10) {
                iconRetryCount += 1;
                window.setTimeout(initIcons, 100);
              }
            }

            function getAgentName(value) {
              var mapping = {
                amp: 'Amp',
                cursor: 'Cursor',
                'github-copilot': 'GitHub Copilot',
                'claude-code': 'Claude Code',
                windsurf: 'Windsurf'
              };
              if (mapping[value]) {
                return mapping[value];
              }
              return value.replace(/(^|[-_])([a-z])/g, function (_, _boundary, letter) {
                return letter.toUpperCase();
              });
            }

            function ensureSelectedAgents() {
              var inputs = document.querySelectorAll('input[name="agents"]');
              inputs.forEach(function (input) {
                if (input.checked) {
                  state.selectedAgents.add(input.value);
                }
              });
              if (state.selectedAgents.size === 0 && inputs.length > 0) {
                state.selectedAgents.add(inputs[0].value);
                inputs[0].checked = true;
              }
            }

            function resolveTimeframe(collection, fallbackKey) {
              if (state.timeframe && collection[state.timeframe]) {
                return state.timeframe;
              }
              if (fallbackKey && collection[fallbackKey]) {
                state.timeframe = fallbackKey;
                setActiveTimeframe(state.timeframe);
                return state.timeframe;
              }
              var keys = Object.keys(collection);
              if (keys.length > 0) {
                state.timeframe = keys[0];
                setActiveTimeframe(state.timeframe);
                return state.timeframe;
              }
              return null;
            }

            function buildSentimentChartData(timeframeKey) {
              var timeframeData = trends[timeframeKey];
              if (!timeframeData || !timeframeData.datasets) {
                return { labels: [], datasets: [] };
              }
              var datasets = [];
              state.selectedAgents.forEach(function (agent) {
                var sentimentSet = timeframeData.datasets[agent];
                if (!sentimentSet) {
                  return;
                }
                var colors = sentimentColors[agent] || sentimentColors.amp;
                datasets.push({
                  label: getAgentName(agent) + ' Positive',
                  data: sentimentSet.positive || [],
                  borderColor: colors.positive,
                  backgroundColor: colors.positive + '20',
                  fill: false,
                  tension: 0.4,
                  pointRadius: 3
                });
                datasets.push({
                  label: getAgentName(agent) + ' Negative',
                  data: sentimentSet.negative || [],
                  borderColor: colors.negative,
                  backgroundColor: colors.negative + '20',
                  fill: false,
                  tension: 0.4,
                  borderDash: [6, 6],
                  pointRadius: 3
                });
              });
              return { labels: timeframeData.labels || [], datasets: datasets };
            }

            function buildShareOfVoiceData(timeframeKey) {
              var timeframeData = shareOfVoice[timeframeKey];
              if (!timeframeData || !timeframeData.datasets) {
                return { labels: [], datasets: [] };
              }
              var datasets = [];
              state.selectedAgents.forEach(function (agent) {
                var agentValues = timeframeData.datasets[agent];
                if (!agentValues) {
                  return;
                }
                var color = voiceColors[agent] || voiceColors.amp;
                datasets.push({
                  label: getAgentName(agent),
                  data: agentValues,
                  borderColor: color,
                  backgroundColor: color + '20',
                  fill: false,
                  tension: 0.4,
                  pointRadius: 3
                });
              });
              return { labels: timeframeData.labels || [], datasets: datasets };
            }

            function getChartData() {
              if (state.view === 'share-of-voice') {
                var shareFallback = defaultTimeframe && shareOfVoice[defaultTimeframe] ? defaultTimeframe : (shareKeys.length > 0 ? shareKeys[0] : null);
                var shareKey = resolveTimeframe(shareOfVoice, shareFallback);
                return shareKey ? buildShareOfVoiceData(shareKey) : { labels: [], datasets: [] };
              }
              var trendFallback = defaultTimeframe && trends[defaultTimeframe] ? defaultTimeframe : (trendKeys.length > 0 ? trendKeys[0] : null);
              var trendKey = resolveTimeframe(trends, trendFallback);
              return trendKey ? buildSentimentChartData(trendKey) : { labels: [], datasets: [] };
            }

            function createChart() {
              var canvas = document.getElementById('sentimentChart');
              if (!canvas || !window.Chart) {
                return;
              }
              var context = canvas.getContext('2d');
              var chartData = getChartData();
              chartInstance = new window.Chart(context, {
                type: 'line',
                data: chartData,
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
                        callback: function (value) {
                          return value + '%';
                        }
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
            }

            function updateChart() {
              if (typeof window === 'undefined') {
                return;
              }
              if (!window.Chart) {
                window.setTimeout(updateChart, 80);
                return;
              }
              if (!chartInstance) {
                createChart();
                if (!chartInstance) {
                  return;
                }
              }
              var chartData = getChartData();
              chartInstance.data.labels = chartData.labels;
              chartInstance.data.datasets = chartData.datasets;
              chartInstance.options.plugins.legend.display = chartData.datasets.length > 0;
              chartInstance.update('none');
            }

            function setActiveTimeframe(period) {
              var buttons = document.querySelectorAll('button[data-period]');
              buttons.forEach(function (button) {
                button.classList.toggle('active', button.dataset.period === period);
              });
              var select = document.getElementById('timeframeFilter');
              if (select && select.value !== period) {
                select.value = period;
              }
            }

            function bindTimeframeControls() {
              var buttons = document.querySelectorAll('button[data-period]');
              buttons.forEach(function (button) {
                button.addEventListener('click', function () {
                  var period = button.dataset.period;
                  if (!period) {
                    return;
                  }
                  state.timeframe = period;
                  setActiveTimeframe(period);
                  updateChart();
                });
              });
              var select = document.getElementById('timeframeFilter');
              if (select) {
                select.addEventListener('change', function () {
                  state.timeframe = select.value;
                  setActiveTimeframe(select.value);
                  updateChart();
                });
              }
              if (state.timeframe) {
                setActiveTimeframe(state.timeframe);
              }
            }

            function bindAgentCheckboxes() {
              var inputs = document.querySelectorAll('input[name="agents"]');
              inputs.forEach(function (input) {
                input.addEventListener('change', function () {
                  if (input.checked) {
                    state.selectedAgents.add(input.value);
                  } else {
                    state.selectedAgents.delete(input.value);
                  }
                  if (state.selectedAgents.size === 0) {
                    state.selectedAgents.add(input.value);
                    input.checked = true;
                  }
                  updateChart();
                });
              });
            }

            function bindViewToggle() {
              var buttons = document.querySelectorAll('#chartViewToggle button[data-view]');
              var applied = false;
              buttons.forEach(function (button) {
                button.addEventListener('click', function () {
                  var view = button.dataset.view;
                  if (!view) {
                    return;
                  }
                  state.view = view;
                  buttons.forEach(function (btn) {
                    btn.classList.toggle('active', btn === button);
                  });
                  updateChart();
                });
                if (!applied && button.dataset.view === state.view) {
                  button.classList.add('active');
                  applied = true;
                }
              });
            }

            function bindHighlightFilter() {
              var select = document.getElementById('highlightFilter');
              if (!select) {
                return;
              }
              var cards = document.querySelectorAll('.highlights-grid .highlight-card');
              function applyFilter() {
                var value = select.value;
                cards.forEach(function (card) {
                  var category = card.getAttribute('data-category') || 'all';
                  var match = value === 'all' || category === value;
                  card.style.display = match ? '' : 'none';
                });
              }
              select.addEventListener('change', applyFilter);
              applyFilter();
            }

            function readDatasetValue(element, key) {
              if (!element || !key) {
                return '';
              }
              var datasetKey = key.replace(/-([a-z])/g, function (_match, letter) {
                return letter.toUpperCase();
              });
              if (element.dataset && Object.prototype.hasOwnProperty.call(element.dataset, datasetKey)) {
                return element.dataset[datasetKey] || '';
              }
              return element.getAttribute('data-' + key) || '';
            }

            function normalizeSocialSource(value) {
              if (!value) {
                return value;
              }
              if (value.indexOf('reddit') !== -1 || value.indexOf('r/') === 0) {
                return 'reddit';
              }
              if (value === 'x' || value.indexOf('twitter') !== -1) {
                return 'x';
              }
              if (value.indexOf('hacker') !== -1) {
                return 'hackernews';
              }
              return value;
            }

            function bindFeedSelect(selectId, sectionSelector, datasetKey, transformFn) {
              var select = document.getElementById(selectId);
              var section = document.querySelector(sectionSelector);
              if (!select || !section) {
                return;
              }
              var attributeSelector = '[data-' + datasetKey + ']';
              var items = Array.prototype.slice.call(section.querySelectorAll(attributeSelector));
              if (items.length === 0) {
                var fallback = datasetKey.replace(/([A-Z])/g, function (_match, letter) {
                  return '-' + letter.toLowerCase();
                });
                items = Array.prototype.slice.call(section.querySelectorAll('[data-' + fallback + ']'));
              }
              function applyFilter() {
                var value = select.value;
                var visibleCount = 0;
                items.forEach(function (item) {
                  var raw = readDatasetValue(item, datasetKey);
                  var current = typeof transformFn === 'function' ? transformFn(raw) : raw;
                  var match = value === 'all' || current === value;
                  item.style.display = match ? '' : 'none';
                  if (match) {
                    visibleCount += 1;
                  }
                });
                var empty = section.querySelector('[data-empty]');
                if (empty) {
                  empty.style.display = visibleCount === 0 ? '' : 'none';
                }
              }
              select.addEventListener('change', applyFilter);
              applyFilter();
            }

            function bindMobileMenu() {
              var toggle = document.getElementById('mobileMenuToggle');
              var sidebar = document.querySelector('.sidebar');
              if (!toggle || !sidebar) {
                return;
              }
              toggle.addEventListener('click', function () {
                sidebar.classList.toggle('open');
              });
              document.addEventListener('click', function (event) {
                if (window.innerWidth > 1024) {
                  return;
                }
                if (!sidebar.contains(event.target) && !toggle.contains(event.target)) {
                  sidebar.classList.remove('open');
                }
              });
            }

            function bindNavigation() {
              var links = document.querySelectorAll('.nav-item');
              var sidebar = document.querySelector('.sidebar');
              links.forEach(function (link) {
                link.addEventListener('click', function (event) {
                  var href = link.getAttribute('href');
                  if (!href || href.charAt(0) !== '#') {
                    return;
                  }
                  var target = document.querySelector(href);
                  if (!target) {
                    return;
                  }
                  event.preventDefault();
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  links.forEach(function (item) {
                    item.classList.remove('active');
                  });
                  link.classList.add('active');
                  if (window.innerWidth <= 1024 && sidebar) {
                    sidebar.classList.remove('open');
                  }
                });
              });
            }

            function init() {
              initIcons();
              ensureSelectedAgents();
              bindAgentCheckboxes();
              bindTimeframeControls();
              bindViewToggle();
              bindHighlightFilter();
              bindFeedSelect('agentFilter', '#updates .content-feed', 'agent');
              bindFeedSelect('researchFilter', '#research .content-feed', 'type');
              bindFeedSelect('perspectiveFilter', '#perspectives .content-feed', 'source');
              bindFeedSelect('socialFilter', '#social .content-feed', 'source', normalizeSocialSource);
              bindMobileMenu();
              bindNavigation();
              updateChart();
            }

            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', init);
            } else {
              init();
            }
          })();
        `}
      </Script>
    </>
  );
}

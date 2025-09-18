import path from "node:path";
import { promises as fs } from "node:fs";

import Script from "next/script";
import type { Metadata } from "next";

import "@/mocks/apify-tweet-scraper/apify-tweet-scraper.css";

export const metadata: Metadata = {
  title: "Tweet Scraper Fixture Explorer | Agent Vibes",
  description:
    "Simplified analytics-style view of Apify Tweet Scraper mock scenarios, inputs, outputs, and sample items hydrated from fixture JSON.",
};

export const dynamic = "force-dynamic";

const ROOT = path.join(process.cwd(), "mocks", "apify-tweet-scraper");
const DATA_ROOT = path.join(ROOT, "data");

type ScenarioManifest = {
  id: string;
  title: string;
  description?: string;
  input: string;
  output: string;
  tags?: string[];
  notes?: string[];
};

type ScenarioInput = {
  includeSearchTerms?: boolean;
  searchTerms?: string[];
  sort?: string;
  tweetLanguage?: string;
  maxItems?: number;
  start?: string;
  end?: string;
  metadata?: {
    description?: string;
    expectedMinimumItems?: number;
  };
};

type ScenarioOutput = {
  actor?: string;
  scenario?: string;
  query?: string;
  retrievedAt?: string;
  statistics?: {
    limit?: number;
    items?: number;
    durationMillis?: number;
    searchRuns?: number;
  };
  items?: TweetItem[];
};

type TweetItem = {
  type?: string;
  id?: string;
  url?: string;
  text?: string;
  retweetCount?: number;
  replyCount?: number;
  likeCount?: number;
  quoteCount?: number;
  bookmarkCount?: number;
  createdAt?: string;
  lang?: string;
  source?: string;
  author?: {
    userName?: string;
    name?: string;
    isVerified?: boolean;
    isBlueVerified?: boolean;
  };
};

type ScenarioData = {
  manifest: ScenarioManifest;
  input: ScenarioInput;
  output: ScenarioOutput;
  sampleTweet?: TweetItem;
};

async function loadScenarioData(): Promise<ScenarioData[]> {
  const scenariosRaw = await fs.readFile(path.join(DATA_ROOT, "scenarios.json"), "utf8");
  const manifests = JSON.parse(scenariosRaw) as ScenarioManifest[];

  const scenarios = await Promise.all(
    manifests.map(async (manifest) => {
      const [inputRaw, outputRaw] = await Promise.all([
        fs.readFile(path.join(DATA_ROOT, manifest.input), "utf8"),
        fs.readFile(path.join(DATA_ROOT, manifest.output), "utf8"),
      ]);

      const input = JSON.parse(inputRaw) as ScenarioInput;
      const output = JSON.parse(outputRaw) as ScenarioOutput;
      const sampleTweet = Array.isArray(output.items)
        ? (output.items.find((item) => item.type === "tweet") as TweetItem | undefined)
        : undefined;

      return { manifest, input, output, sampleTweet } satisfies ScenarioData;
    }),
  );

  return scenarios;
}

const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value?: number | null): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return numberFormatter.format(value);
}

function formatDuration(durationMillis?: number): string {
  if (durationMillis === undefined || durationMillis === null) {
    return "—";
  }

  const seconds = durationMillis / 1000;
  return `${seconds.toFixed(1)}s`;
}

function formatDate(value?: string, options: Intl.DateTimeFormatOptions = {}): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const formatter = new Intl.DateTimeFormat("en-US", options);
  return formatter.format(date);
}

function formatDateRange(start?: string, end?: string): string {
  if (!start && !end) {
    return "Not specified";
  }

  const formattedStart = formatDate(start, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedEnd = formatDate(end, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (formattedStart && formattedEnd) {
    return `${formattedStart} → ${formattedEnd}`;
  }

  return formattedStart ?? formattedEnd ?? "Not specified";
}

function formatRetrievedAt(value?: string): string {
  if (!value) {
    return "Retrieved: Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return `Retrieved: ${value}`;
  }

  const iso = date.toISOString();
  const normalized = iso.replace("T", " ").replace(/:\d{2}\.\d+Z$/, " UTC");
  return `Retrieved: ${normalized}`;
}

function formatTweetTimestamp(value?: string, source?: string): string {
  if (!value) {
    return source ?? "";
  }

  const formatted = formatDate(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (!formatted) {
    return `${value}${source ? ` · ${source}` : ""}`;
  }

  return `${formatted}${source ? ` · ${source}` : ""}`;
}

function formatAuthorHandle(tweet?: TweetItem): string {
  const author = tweet?.author;
  if (!author) {
    return "";
  }

  const handle = author.userName ? `@${author.userName}` : "@unknown";
  const statusParts: string[] = [];

  if (author.isVerified) {
    statusParts.push("Verified");
  }

  if (author.isBlueVerified) {
    statusParts.push("Blue Verified");
  }

  const suffix = statusParts.length ? ` · ${statusParts.join(" · ")}` : "";
  return `${handle}${suffix}`;
}

function formatSampleStat(label: string, icon: string, value?: number): { label: string; icon: string; value: string } {
  return {
    label,
    icon,
    value: formatNumber(value ?? 0),
  };
}

export default async function ApifyTweetScraperPage() {
  const scenarios = await loadScenarioData();

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon">AP</div>
            <span className="brand-text">Apify Fixtures</span>
          </div>
          <p className="sidebar-subtitle">Tweet Scraper V2</p>
        </div>

        <nav className="sidebar-nav">
          <a href="#overview" className="nav-item active">
            <i data-lucide="layout-dashboard" />
            <span>Overview</span>
          </a>
          <a href="#inputs" className="nav-item">
            <i data-lucide="sliders" />
            <span>Inputs</span>
          </a>
          <a href="#outputs" className="nav-item">
            <i data-lucide="activity" />
            <span>Outputs</span>
          </a>
          <a href="#samples" className="nav-item">
            <i data-lucide="messages-square" />
            <span>Sample Tweets</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="footer-label">Fixture Location</div>
          <p>mocks/apify-tweet-scraper</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <div className="page-title">
            <h1>Tweet Scraper Fixture Explorer</h1>
            <p className="page-description">
              Simplified view of deterministic scenarios, paired inputs, and representative output metrics hydrated from source JSON.
            </p>
          </div>
          <div className="header-meta">
            <span className="meta-chip">
              <i data-lucide="database" />
              {scenarios.length} curated fixture{scenarios.length === 1 ? "" : "s"}
            </span>
          </div>
        </header>

        <div className="content-container">
          <section id="overview" className="section">
            <div className="section-header">
              <h2 className="section-title">Scenario Overview</h2>
              <div className="section-actions">
                <span className="meta-chip subtle">
                  <i data-lucide="info" />
                  Data sourced from scenarios.json
                </span>
              </div>
            </div>

            <div className="scenario-grid">
              {scenarios.map(({ manifest }) => (
                <article key={manifest.id} className="card scenario-card">
                  <header className="card-header">
                    <div className="card-title">
                      <h3>{manifest.title}</h3>
                      <span className="badge">{manifest.tags?.[0] ?? "Scenario"}</span>
                    </div>
                    {manifest.description ? (
                      <p className="card-description">{manifest.description}</p>
                    ) : null}
                  </header>
                  <div className="card-content">
                    {manifest.tags?.length ? (
                      <div className="tag-row">
                        {manifest.tags.map((tag) => (
                          <span key={tag} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {manifest.notes?.length ? (
                      <ul className="note-list">
                        {manifest.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="inputs" className="section">
            <div className="section-header">
              <h2 className="section-title">Input Configuration</h2>
              <div className="section-actions">
                <span className="meta-chip subtle">
                  <i data-lucide="file-text" />
                  JSON payloads mapped 1:1 with scenarios
                </span>
              </div>
            </div>

            <div className="detail-grid">
              {scenarios.map(({ manifest, input }) => (
                <article key={manifest.id} className="card detail-card">
                  <header className="card-header">
                    <div className="card-title">
                      <h3>{manifest.title}</h3>
                      <span className="badge">Input</span>
                    </div>
                    <p className="card-description">{manifest.input}</p>
                  </header>
                  <div className="card-content">
                    <dl className="definition-list">
                      <div>
                        <dt>Search terms</dt>
                        <dd>
                          {input.searchTerms && input.searchTerms.length ? (
                            <code>{input.searchTerms.join(" · ")}</code>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Time window</dt>
                        <dd>{formatDateRange(input.start, input.end)}</dd>
                      </div>
                      <div>
                        <dt>Language</dt>
                        <dd>{input.tweetLanguage ?? "Not specified"}</dd>
                      </div>
                      <div>
                        <dt>Max items</dt>
                        <dd>{formatNumber(input.maxItems)}</dd>
                      </div>
                    </dl>
                    <div className="inline-stats">
                      <span className="stat-chip">
                        <i data-lucide="toggle-left" />
                        Include search terms: {input.includeSearchTerms ? "on" : "off"}
                      </span>
                      {input.sort ? (
                        <span className="stat-chip">
                          <i data-lucide="sparkles" />
                          Sort: {input.sort}
                        </span>
                      ) : null}
                      {input.metadata?.expectedMinimumItems ? (
                        <span className="stat-chip">
                          <i data-lucide="target" />
                          Expected ≥ {formatNumber(input.metadata.expectedMinimumItems)} items
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="outputs" className="section">
            <div className="section-header">
              <h2 className="section-title">Output Snapshot</h2>
              <div className="section-actions">
                <span className="meta-chip subtle">
                  <i data-lucide="download" />
                  Deterministic JSON slices for assertions
                </span>
              </div>
            </div>

            <div className="detail-grid">
              {scenarios.map(({ manifest, output }) => (
                <article key={manifest.id} className="card detail-card">
                  <header className="card-header">
                    <div className="card-title">
                      <h3>{manifest.title}</h3>
                      <span className="badge">Output</span>
                    </div>
                    <p className="card-description">{manifest.output}</p>
                  </header>
                  <div className="card-content">
                    <div className="stat-grid">
                      <div className="stat">
                        <div className="stat-label">Items</div>
                        <div className="stat-value">{formatNumber(output.statistics?.items)}</div>
                      </div>
                      <div className="stat">
                        <div className="stat-label">Limit</div>
                        <div className="stat-value">{formatNumber(output.statistics?.limit)}</div>
                      </div>
                      <div className="stat">
                        <div className="stat-label">Duration</div>
                        <div className="stat-value">{formatDuration(output.statistics?.durationMillis)}</div>
                      </div>
                      <div className="stat">
                        <div className="stat-label">Search runs</div>
                        <div className="stat-value">{formatNumber(output.statistics?.searchRuns)}</div>
                      </div>
                    </div>
                    <div className="output-meta">
                      <span className="meta-chip subtle">
                        <i data-lucide="calendar" />
                        {formatRetrievedAt(output.retrievedAt)}
                      </span>
                      {output.query ? (
                        <span className="meta-chip subtle">
                          <i data-lucide="link" />
                          Query: {output.query}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="samples" className="section">
            <div className="section-header">
              <h2 className="section-title">Sample Tweets</h2>
              <div className="section-actions">
                <span className="meta-chip subtle">
                  <i data-lucide="message-circle" />
                  One representative item per scenario
                </span>
              </div>
            </div>

            <div className="detail-grid">
              {scenarios.map(({ manifest, sampleTweet }) => (
                <article key={manifest.id} className="card tweet-card">
                  {sampleTweet ? (
                    <>
                      <header className="tweet-header">
                        <div className="tweet-author">
                          <div className="avatar">
                            {sampleTweet.author?.name?.slice(0, 2).toUpperCase() ?? "TW"}
                          </div>
                          <div className="author-meta">
                            <span className="author-name">{sampleTweet.author?.name ?? "Unknown"}</span>
                            <span className="author-handle">{formatAuthorHandle(sampleTweet)}</span>
                          </div>
                        </div>
                        {sampleTweet.url ? (
                          <a className="tweet-link" href={sampleTweet.url} target="_blank" rel="noopener noreferrer">
                            <i data-lucide="external-link" />
                          </a>
                        ) : null}
                      </header>
                      <div className="tweet-body">
                        <p>{sampleTweet.text ?? "Tweet text unavailable."}</p>
                        <div className="tweet-meta">
                          <span>{formatTweetTimestamp(sampleTweet.createdAt, sampleTweet.source)}</span>
                          {sampleTweet.id ? <span>ID: {sampleTweet.id}</span> : null}
                        </div>
                        <div className="tweet-stats">
                          {[
                            formatSampleStat("Likes", "heart", sampleTweet.likeCount),
                            formatSampleStat("Retweets", "repeat", sampleTweet.retweetCount),
                            formatSampleStat("Replies", "message-circle", sampleTweet.replyCount),
                            formatSampleStat("Quotes", "quote", sampleTweet.quoteCount),
                            sampleTweet.bookmarkCount !== undefined
                              ? formatSampleStat("Bookmarks", "bookmark", sampleTweet.bookmarkCount)
                              : null,
                          ]
                            .filter(Boolean)
                            .map((stat) => (
                              <span key={stat!.label}>
                                <i data-lucide={stat!.icon} /> {stat!.value}
                              </span>
                            ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="tweet-body">
                      <p>No representative tweet found in output slice.</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>

      <Script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" strategy="afterInteractive" />
      <Script id="lucide-init" strategy="afterInteractive">
        {`if (window.lucide) { window.lucide.createIcons(); }`}
      </Script>
    </>
  );
}

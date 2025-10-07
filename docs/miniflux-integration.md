# Miniflux RSS Integration Guide

## Overview

This guide explains how to integrate Miniflux RSS reader with the Agent Vibes dashboard to populate product updates, research papers, and perspective pieces with real data.

## Architecture

```
RSS Feeds → Miniflux → Miniflux API → Next.js API Routes → Dashboard
                              ↓
                    miniflux-summary-agent
                              ↓
                         Ollama (llama3.1:8b)
                              ↓
                        TL;DR Summaries
```

## Miniflux Setup

### 1. Install Miniflux

Self-hosted option (recommended for full control):
```bash
docker run -d \
  --name miniflux \
  -p 8080:8080 \
  -e DATABASE_URL="postgres://miniflux:secret@db/miniflux?sslmode=disable" \
  miniflux/miniflux:latest
```

Or use the hosted version at https://reader.miniflux.app

### 2. Generate API Key

1. Log into Miniflux
2. Go to Settings → API Keys
3. Create a new API key
4. Save it to your `.env.local`:

```env
MINIFLUX_URL=https://your-miniflux-instance.com
MINIFLUX_API_KEY=your_api_key_here
```

### 3. Add RSS Feeds

Add relevant feeds to Miniflux categories:

**Product Updates Category:**
- Cursor changelog
- GitHub Copilot updates
- Amp release notes
- Windsurf announcements

**Research Papers Category:**
- arXiv AI/ML feed
- Papers with Code
- HuggingFace papers

**Perspective Pieces Category:**
- Tech blogs (a16z, etc.)
- Developer advocates
- Industry thought leaders

## Miniflux API Integration

### API Route: `/api/rss/entries`

Create a Next.js API route to fetch and transform Miniflux entries:

```typescript
// app/api/rss/entries/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface MinifluxEntry {
  id: number;
  title: string;
  url: string;
  content: string;
  author: string;
  published_at: string;
  feed: {
    id: number;
    title: string;
    category: {
      id: number;
      title: string;
    };
  };
  starred: boolean;
  reading_time: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category'); // 'product', 'research', 'perspective'
  const limit = parseInt(searchParams.get('limit') || '20');
  const status = searchParams.get('status') || 'unread';

  const minifluxUrl = process.env.MINIFLUX_URL;
  const apiKey = process.env.MINIFLUX_API_KEY;

  if (!minifluxUrl || !apiKey) {
    return NextResponse.json(
      { error: 'Miniflux not configured' },
      { status: 500 }
    );
  }

  try {
    // Fetch entries from Miniflux
    const response = await fetch(
      `${minifluxUrl}/v1/entries?status=${status}&limit=${limit}&direction=desc&order=published_at`,
      {
        headers: {
          'X-Auth-Token': apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from Miniflux');
    }

    const data = await response.json();
    const entries: MinifluxEntry[] = data.entries || [];

    // Filter by category if specified
    let filteredEntries = entries;
    if (category) {
      filteredEntries = entries.filter((entry) =>
        entry.feed.category.title.toLowerCase().includes(category.toLowerCase())
      );
    }

    // Transform to dashboard format
    const transformed = filteredEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      url: entry.url,
      summary: extractSummary(entry.content),
      author: entry.author,
      publishedAt: entry.published_at,
      source: entry.feed.title,
      category: entry.feed.category.title,
      starred: entry.starred,
      readingTime: entry.reading_time,
    }));

    return NextResponse.json({
      entries: transformed,
      total: transformed.length,
    });
  } catch (error) {
    console.error('Error fetching RSS entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS entries' },
      { status: 500 }
    );
  }
}

function extractSummary(html: string): string {
  // Strip HTML and get first 200 characters
  const text = html.replace(/<[^>]*>/g, '');
  return text.substring(0, 200) + (text.length > 200 ? '...' : '');
}
```

## AI Summary Generation with miniflux-summary-agent

### Setup

1. **Install Ollama:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

2. **Download model:**
```bash
ollama pull llama3.1:8b
```

3. **Clone summary agent:**
```bash
git clone https://github.com/trly/miniflux-summary-agent.git
cd miniflux-summary-agent
```

4. **Configure:**
```bash
# .env
MINIFLUX_URL=https://your-instance.com
MINIFLUX_API_KEY=your_key
ARTICLE_HOURS_BACK=24
LOG_LEVEL=INFO
```

5. **Run:**
```bash
python main.py
```

### Integration Pattern

The summary agent generates HTML reports. To integrate with your dashboard:

**Option 1: Scheduled Job**
Run the summary agent on a cron schedule and store results in Supabase:

```typescript
// scripts/fetch-rss-summaries.ts
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';

async function fetchAndStoreSummaries() {
  // Run summary agent
  exec('cd /path/to/miniflux-summary-agent && python main.py', async (error, stdout) => {
    if (error) {
      console.error('Summary generation failed:', error);
      return;
    }

    // Parse HTML output and extract summaries
    const summaries = parseSummaryHTML(stdout);

    // Store in Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from('rss_summaries').upsert(summaries);
  });
}
```

**Option 2: On-Demand API**
Create an API route that triggers summary generation:

```typescript
// app/api/rss/generate-summary/route.ts
export async function POST(request: Request) {
  const { articleUrl, content } = await request.json();

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.1:8b',
      prompt: `Summarize this article in 2-4 sentences:\n\n${content}`,
      stream: false,
    }),
  });

  const data = await response.json();
  return NextResponse.json({ summary: data.response });
}
```

## Database Schema

Store RSS content and summaries in Supabase:

```sql
-- RSS entries table
CREATE TABLE rss_entries (
  id BIGSERIAL PRIMARY KEY,
  miniflux_id INTEGER UNIQUE NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  ai_summary TEXT, -- Generated by summary agent
  author TEXT,
  source TEXT,
  category TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  starred BOOLEAN DEFAULT false,
  reading_time INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for queries
CREATE INDEX idx_rss_entries_category ON rss_entries(category);
CREATE INDEX idx_rss_entries_published ON rss_entries(published_at DESC);
CREATE INDEX idx_rss_entries_starred ON rss_entries(starred) WHERE starred = true;
```

## Dashboard Integration

### Product Updates Section

```typescript
// app/dashboard-v2/components/ProductUpdates.tsx
'use client';

import { useEffect, useState } from 'react';

export default function ProductUpdates() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    fetch('/api/rss/entries?category=product&limit=10')
      .then((r) => r.json())
      .then((data) => setEntries(data.entries));
  }, []);

  return (
    <section id="updates" className="section">
      <h2 className="section-title">Product Updates</h2>
      <div className="highlights-grid">
        {entries.map((entry) => (
          <div key={entry.id} className="highlight-card product">
            <div className="highlight-header">
              <div className="highlight-badge product">Product Update</div>
              <span className="highlight-time">
                {new Date(entry.publishedAt).toLocaleString()}
              </span>
            </div>
            <h3>{entry.title}</h3>
            <p>{entry.ai_summary || entry.summary}</p>
            <a href={entry.url} target="_blank" rel="noopener">
              Read more →
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
```

## Environment Variables

Add to `.env.local`:

```env
# Miniflux
MINIFLUX_URL=https://your-miniflux.com
MINIFLUX_API_KEY=your_key

# Ollama (for local summary generation)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

## Deployment Considerations

### Vercel Edge Functions
- Miniflux API calls work well in edge functions
- Summary generation should run as cron jobs (heavy compute)

### Caching
```typescript
// Cache RSS entries for 5 minutes
export const revalidate = 300;
```

### Rate Limiting
Miniflux API doesn't have published rate limits, but be respectful:
- Cache aggressively
- Use webhooks if Miniflux supports them
- Batch requests

## Testing

```bash
# Test Miniflux API connection
curl -H "X-Auth-Token: your_key" \
  https://your-miniflux.com/v1/entries?limit=5

# Test summary generation
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Summarize: [article text]",
  "stream": false
}'
```

## Next Steps

1. Set up Miniflux instance
2. Configure API keys
3. Create Supabase tables
4. Implement `/api/rss/entries` route
5. Set up summary generation cron job
6. Connect dashboard components
7. Test end-to-end flow

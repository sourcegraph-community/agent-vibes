# RSS Pipeline

Vertical Slice Architecture (VSA) implementation for RSS feed integration with Miniflux (external) or an in-house aggregator, and AI summarization.

## Structure

```
src/RssPipeline/
├── Core/
│   ├── Models/              # Domain types
│   │   ├── RssEntry.ts      # RSS entry and summary types
│   │   └── RssCategory.ts   # Category definitions
│   ├── Services/            # Business logic services
│   └── Transformations/     # Data transformation utilities
│       ├── htmlStripper.ts  # HTML content cleanup
│       └── categoryMapper.ts # Auto-categorization logic
├── DataAccess/
│   └── Repositories/
│       └── RssRepository.ts # Database operations
├── ExternalServices/
│   ├── Miniflux/            # Miniflux RSS reader client
│   │   ├── client.ts
│   │   └── inhouse.ts
│   └── Summarizer/          # Ollama summarization client
│       └── client.ts
└── Web/
    └── Application/
        └── Commands/        # API endpoints and handlers
            ├── SyncEntries/     # Fetch entries from Miniflux
            └── GenerateSummaries/ # Generate AI summaries

## Features

- **RSS Collection**: Fetch entries via Miniflux (external) or in-house aggregator
- **Auto-categorization**: Classify entries into product updates, research, or perspectives
- **AI Summarization**: Generate summaries via Ollama (llama3.1:8b)
- **Sentiment Analysis**: Extract sentiment and topics from content
- **Dashboard Integration**: Ready for `/dashboard-v2` consumption

## API Endpoints

- `POST /api/rss/sync` - Sync entries (external Miniflux or in-house)
- `POST /api/rss/summarize` - Generate summaries for pending entries
- `GET /api/rss/entries` - Retrieve entries with summaries

## Environment Variables

```bash
# Mode: 'external' | 'inhouse' (default: external)
MINIFLUX_MODE=external

# External Miniflux (used when MINIFLUX_MODE=external)
MINIFLUX_URL=http://localhost:8080
MINIFLUX_API_KEY=your-api-key

# In-house aggregator (used when MINIFLUX_MODE=inhouse)
# Single-line JSON array
# INHOUSE_RSS_FEEDS=[{"url":"https://hnrss.org/frontpage","title":"Hacker News","category":"industry_research"}]
INHOUSE_RSS_FEEDS=
INHOUSE_RSS_TIMEOUT_MS=20000
INHOUSE_RSS_MAX_CONCURRENCY=5

# Summarization
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

## Database Schema

See migration: `supabase/migrations/002_rss_pipeline.sql`

Tables:
- `rss_entries` - RSS feed entries with categorization
- `rss_summaries` - AI-generated summaries with sentiment

## Usage

```typescript
import { syncEntriesCommandHandler } from '@/src/RssPipeline/Web/Application/Commands/SyncEntries';
import { generateSummariesCommandHandler } from '@/src/RssPipeline/Web/Application/Commands/GenerateSummaries';

// Sync entries
const syncResult = await syncEntriesCommandHandler({
  options: { limit: 50, status: 'unread' }
});

// Generate summaries
const summaryResult = await generateSummariesCommandHandler({
  options: { batchSize: 10 }
});
```

# RSS Pipeline

Vertical Slice Architecture (VSA) implementation for RSS feed integration with an in-house aggregator and AI summarization.

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
│   ├── Miniflux/            # In-house RSS reader client
│   │   ├── client.ts
│   │   └── inhouse.ts
│   └── Summarizer/          # Ollama summarization client
│       └── client.ts
└── Web/
    └── Application/
        └── Commands/        # API endpoints and handlers
            ├── SyncEntries/     # Fetch entries (in-house)
            └── GenerateSummaries/ # Generate AI summaries

## Features

- **RSS Collection**: Fetch entries via the in-house aggregator
- **Auto-categorization**: Classify entries into product updates, research, or perspectives
- **AI Summarization**: Generate summaries via Ollama (llama3.1:8b)
- **Sentiment Analysis**: Extract sentiment and topics from content
- **Dashboard Integration**: Ready for `/dashboard-v2` consumption

### Categorization Policy

- Feed-provided category is authoritative when valid (validated at runtime against `RssCategory`).
- For known research sources (small whitelist of domains such as `arxiv.org`, `export.arxiv.org`, `paperswithcode.com`, selected Substack hosts), we intentionally override to `industry_research`.
- When no valid feed category is present and the host is not in the whitelist, we fall back to keyword inference across title/content/feed title.

## API Endpoints

- `POST /api/rss/sync` - Sync entries (in-house)
- `POST /api/rss/summarize` - Generate summaries for pending entries
- `GET /api/rss/entries` - Retrieve entries with summaries

## Environment Variables

```bash
# In-house RSS aggregator (single source of truth)
# Provide a single-line JSON array of feed configs:
# OPML sources are hardcoded in code (see ExternalServices/Miniflux/inhouse.ts)
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

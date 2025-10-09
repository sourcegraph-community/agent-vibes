# RSS Pipeline

Vertical Slice Architecture (VSA) implementation for RSS feed integration with Miniflux and AI summarization.

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
│   │   └── client.ts
│   └── Summarizer/          # Ollama summarization client
│       └── client.ts
└── Web/
    └── Application/
        └── Commands/        # API endpoints and handlers
            ├── SyncEntries/     # Fetch entries from Miniflux
            └── GenerateSummaries/ # Generate AI summaries

## Features

- **RSS Collection**: Fetch entries from Miniflux
- **Auto-categorization**: Classify entries into product updates, research, or perspectives
- **AI Summarization**: Generate summaries via Ollama (llama3.1:8b)
- **Sentiment Analysis**: Extract sentiment and topics from content
- **Dashboard Integration**: Ready for `/dashboard-v2` consumption

## API Endpoints

- `POST /api/rss/sync` - Sync entries from Miniflux
- `POST /api/rss/summarize` - Generate summaries for pending entries
- `GET /api/rss/entries` - Retrieve entries with summaries

## Environment Variables

```bash
MINIFLUX_BASE_URL=http://localhost:8080
MINIFLUX_API_KEY=your-api-key
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

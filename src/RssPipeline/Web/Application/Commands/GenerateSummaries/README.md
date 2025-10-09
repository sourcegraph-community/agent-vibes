# Generate Summaries Command

This command handles the atomic claiming and processing of RSS entries for AI summary generation using Ollama.

## Overview

The `GenerateSummariesCommand` implements a robust, atomic batch processing pattern that:

1. **Resets stuck entries** - Entries stuck in `processing_summary` status for >30 minutes are reset to `pending_summary`
2. **Atomically claims entries** - Uses PostgreSQL's `FOR UPDATE SKIP LOCKED` to prevent duplicate processing
3. **Generates summaries** - Calls `OllamaSummarizer.generateSummary()` for each claimed entry
4. **Handles failures** - Implements retry logic with configurable max attempts
5. **Reports metrics** - Returns detailed statistics about processing results

## Command Schema

```typescript
{
  triggerSource: string,          // 'cron' | 'manual' | etc.
  requestedBy?: string,            // Optional user identifier
  dryRun?: boolean,                // If true, claims entries but doesn't process
  options: {
    batchSize: number,             // 1-100, default: 20
    maxRetries: number,            // 1-5, default: 3
    resetStuckEntries: boolean     // default: true
  },
  metadata?: Record<string, unknown>
}
```

## Atomic Claim Pattern

The command uses a database-level atomic claim mechanism to prevent duplicate processing:

```sql
CREATE FUNCTION claim_pending_summaries(p_batch_size, p_max_attempts)
RETURNS SETOF rss_entries AS $$
  UPDATE rss_entries
  SET status = 'processing_summary', status_changed_at = NOW()
  WHERE id IN (
    SELECT id FROM rss_entries
    WHERE status = 'pending_summary'
    ORDER BY published_at DESC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED  -- Key: Skip locked rows
  )
  RETURNING *;
$$;
```

### Why `FOR UPDATE SKIP LOCKED`?

- **Prevents blocking**: Concurrent processes skip locked rows instead of waiting
- **No duplicates**: Only one process can claim each entry
- **Performance**: No need for application-level locking or retries

## Processing Flow

```
┌─────────────────────────────────────┐
│ 1. Reset Stuck Entries              │
│    (processing_summary > 30min)     │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 2. Atomic Claim                     │
│    claim_pending_summaries(20, 3)   │
│    → Returns entries with status    │
│      = 'processing_summary'         │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 3. For Each Entry:                  │
│    ┌─────────────────────────────┐  │
│    │ a. Call OllamaSummarizer    │  │
│    │ b. Insert into rss_summaries│  │
│    │ c. Update status=summarized │  │
│    └─────────────────────────────┘  │
│                                     │
│    On Error:                        │
│    ┌─────────────────────────────┐  │
│    │ a. Update status=failed     │  │
│    │ b. Log error                │  │
│    └─────────────────────────────┘  │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 4. Return Statistics                │
│    - summariesGenerated             │
│    - summariesFailed                │
│    - entriesReset                   │
│    - queueDepth                     │
│    - errors[]                       │
└─────────────────────────────────────┘
```

## Error Handling

### Retry Logic

The command uses the `maxRetries` setting from the RPC function parameters. The database function handles retry eligibility by only claiming entries that haven't exceeded the max attempts.

When an entry fails:
1. Status is set to `failed` (no automatic retry in this simplified version)
2. Error is logged and included in response
3. Processing continues with remaining entries

### Stuck Entry Recovery

Entries stuck in `processing_summary` for >30 minutes are automatically reset to `pending_summary` at the start of each batch run. This handles cases where:
- Process crashes mid-execution
- Ollama hangs and times out
- Network failures occur

## Usage

### Via API Endpoint

```typescript
// POST /api/rss/summarize
// Headers: Authorization: Bearer {CRON_SECRET}

const response = await fetch('/api/rss/summarize', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.CRON_SECRET}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    triggerSource: 'cron',
    options: {
      batchSize: 20,
      maxRetries: 3,
    },
  }),
});
```

### Direct Invocation

```typescript
import { generateSummariesCommandHandler } from './GenerateSummariesCommandHandler';

const result = await generateSummariesCommandHandler({
  triggerSource: 'manual',
  requestedBy: 'admin@example.com',
  options: {
    batchSize: 10,
    maxRetries: 3,
    resetStuckEntries: true,
  },
});

console.log(result);
// {
//   success: true,
//   summariesGenerated: 8,
//   summariesFailed: 2,
//   entriesReset: 1,
//   queueDepth: 42,
//   errors: [
//     'Entry abc123: Timeout after 30s',
//     'Entry def456: Connection refused'
//   ]
// }
```

## Configuration

### Environment Variables

```bash
# Ollama Configuration
OLLAMA_URL=http://localhost:11434           # Ollama API endpoint
OLLAMA_MODEL=llama3.1:8b                    # Model to use for summaries

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx               # Required for atomic RPC calls

# Cron Authentication (for API endpoint)
CRON_SECRET=xxx                             # Shared secret for cron jobs
```

### Tuning Parameters

**Batch Size** (1-100, default: 20)
- Lower: More frequent processing, less memory usage
- Higher: Better throughput, but risks timeout on slower Ollama instances

**Max Retries** (1-5, default: 3)
- Affects how many times the database will allow claiming an entry
- Implemented at the database level via RPC function

**Timeout** (hardcoded: 30000ms)
- Per-request timeout for Ollama API calls
- Prevents indefinite hangs

## Monitoring

### Key Metrics

```typescript
{
  summariesGenerated: number,  // Success count
  summariesFailed: number,     // Failure count
  entriesReset: number,        // Stuck entries recovered
  queueDepth: number,          // Remaining pending entries
  errors: string[]             // Detailed error messages
}
```

### Logging

The handler logs at these points:
1. Entry reset: `[GenerateSummaries] Reset N stuck entries`
2. Batch start: `[GenerateSummaries] Processing N entries`
3. Success: `[GenerateSummaries] Entry X summarized in Yms`
4. Failure: `[GenerateSummaries] Entry X failed: error`
5. Completion: `[GenerateSummaries] Complete: X succeeded, Y failed, queue depth: Z`

### Alerting Thresholds

- **Queue depth > 500**: Backlog growing, increase frequency or batch size
- **Consecutive failures > 3 runs**: Ollama may be down
- **Average latency > 25s**: Ollama performance degraded

## Testing

### Unit Tests

```typescript
// Test atomic claim prevents duplicates
test('concurrent claims do not process same entry twice', async () => {
  // Setup: 10 pending entries
  // Execute: 3 parallel claim calls with batchSize=5
  // Assert: All 10 entries claimed exactly once
});

// Test stuck entry reset
test('resets entries stuck in processing_summary', async () => {
  // Setup: Entry with status=processing_summary, updated 45min ago
  // Execute: generateSummariesCommandHandler
  // Assert: Entry reset to pending_summary
});
```

### Integration Tests

```bash
# Manual backfill test
npm run enqueue:test-batch      # Create 20 test entries
npm run process:summaries       # Process batch
# Verify: All entries summarized, no duplicates
```

## Troubleshooting

### Issue: High Failure Rate

**Symptoms**: `summariesFailed` consistently high

**Diagnosis**:
1. Check Ollama logs: `docker logs ollama`
2. Test connectivity: `curl $OLLAMA_URL/api/generate`
3. Check model availability: `ollama list`

**Solutions**:
- Ensure Ollama is running and accessible
- Verify model is pulled: `ollama pull llama3.1:8b`
- Increase timeout if content is very long

### Issue: Queue Depth Growing

**Symptoms**: `queueDepth` increasing over time

**Diagnosis**:
1. Check processing rate vs ingestion rate
2. Review failure logs for patterns

**Solutions**:
- Increase batch size (up to 100)
- Increase cron frequency (e.g., every 10min)
- Scale Ollama instance (more RAM/CPU)

### Issue: Duplicate Summaries

**Symptoms**: Multiple summaries for same entry

**Diagnosis**:
- Check if `claim_pending_summaries` function exists
- Verify PostgreSQL version supports `SKIP LOCKED` (≥9.5)

**Solutions**:
- Run migration: `002_create_claim_pending_summaries_function.sql`
- Verify with: `SELECT * FROM pg_proc WHERE proname = 'claim_pending_summaries'`

## Related Files

- **Command**: [GenerateSummariesCommand.ts](./GenerateSummariesCommand.ts)
- **Handler**: [GenerateSummariesCommandHandler.ts](./GenerateSummariesCommandHandler.ts)
- **Repository**: [RssRepository.ts](../../../../DataAccess/Repositories/RssRepository.ts)
- **Summarizer**: [OllamaSummarizer.ts](../../../../ExternalServices/Summarizer/OllamaSummarizer.ts)
- **Migration**: [002_create_claim_pending_summaries_function.sql](../../../../../../supabase/migrations/002_create_claim_pending_summaries_function.sql)
- **API Endpoint**: [app/api/rss/summarize/route.ts](../../../../../../../app/api/rss/summarize/route.ts) (to be created)

## Future Enhancements

1. **Add summary_attempts column** for explicit retry tracking
2. **Implement exponential backoff** for retries
3. **Add priority queue** (process starred/important entries first)
4. **Parallel processing** using p-limit for concurrent Ollama calls
5. **Metrics persistence** in `rss_job_runs` table

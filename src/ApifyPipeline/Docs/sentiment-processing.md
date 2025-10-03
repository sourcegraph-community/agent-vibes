# Sentiment Processing (Milestone 3)

## Overview

The sentiment processing system analyzes tweets about coding agents using Google's Gemini 2.0 Flash API. It processes tweets marked as `pending_sentiment` and classifies them as positive, neutral, or negative.

## Architecture

### Components

```
ExternalServices/Gemini/
├── GeminiClient.ts              # API client with retry logic
├── promptTemplate.ts            # Prompt engineering for sentiment analysis
└── types.ts                     # Type definitions

Core/Services/
└── SentimentProcessor.ts        # Business logic for batch processing

DataAccess/Repositories/
└── TweetSentimentsRepository.ts # Database operations

Background/Jobs/SentimentProcessor/
└── SentimentProcessorJob.ts     # Batch processing job

Web/Application/Commands/ProcessSentiments/
├── ProcessSentimentsCommand.ts
├── ProcessSentimentsCommandHandler.ts
└── ProcessSentimentsEndpoint.ts # API endpoint
```

### Data Flow

1. **Trigger**: API endpoint `/api/process-sentiments` or background job
2. **Fetch**: Query `normalized_tweets` with `status = 'pending_sentiment'`
3. **Process**: Call Gemini API with structured prompt
4. **Store**: Insert results into `tweet_sentiments` table
5. **Update**: Create new revision with `status = 'processed'` or `'failed'`
6. **Error Handling**: Record failures in `sentiment_failures` table

## API Endpoints

### POST /api/process-sentiments

Process pending tweets for sentiment analysis.

**Authentication:**
- Vercel Cron: Automatically authenticated via `x-vercel-cron` header
- Manual calls: Require `x-api-key` header with value matching `INTERNAL_API_KEY` environment variable

**Request Body:**
```json
{
  "batchSize": 10,
  "modelVersion": "gemini-2.0-flash-exp"
}
```

**Request Headers (for manual calls):**
```
x-api-key: <your-internal-api-key>
```

**Response:**
```json
{
  "success": true,
  "message": "Processed 8 tweets, 0 failed",
  "stats": {
    "processed": 8,
    "failed": 0,
    "skipped": 0,
    "totalLatencyMs": 3245,
    "totalTokens": 1420
  }
}
```

## CLI Scripts

### Replay Failed Sentiments

```bash
npm run replay:sentiments -- [options]

Options:
  --min-retry-count <n>  Minimum retry count (default: 0)
  --limit <n>            Maximum number to replay (default: 50)
  --dry-run              Show what would be replayed without executing
  --help                 Show help message
```

**Example:**
```bash
# Dry run to see what would be replayed
npm run replay:sentiments -- --dry-run

# Replay up to 20 failed sentiments
npm run replay:sentiments -- --limit 20
```

## Recent Updates (2025-10-03)

- Added standalone script `npm run process:sentiments` for local/manual runs; uses `NUMBER_OF_PENDING_TWEETS` as default batch size (clamped 1..25). Optional: `SENTIMENT_MAX_RETRIES`, `SENTIMENT_MODEL_VERSION`.
- Node job supports concurrency and rate capping via env:
  - `SENTIMENT_CONCURRENCY` (default 1), `SENTIMENT_RPM_CAP` (default 15), `SENTIMENT_TPM_CAP` (optional), `SENTIMENT_TOKENS_PER_REQUEST_ESTIMATE` (default 600).
- Gemini client improvements:
  - Enforces structured JSON via `responseSchema` and `responseMimeType`.
  - Sets `safetySettings` with `BLOCK_NONE` for all categories to avoid safety blocking in this classification use case.
  - Increases `maxOutputTokens` to 512; retries on transient `EMPTY_RESPONSE`; handles `promptFeedback.blockReason` and candidate `finishReason` (`MAX_TOKENS` retryable; `SAFETY`/`BLOCKLIST` non-retryable).
  - Adds concise debug logs for HTTP errors, empty parts, and parse previews.
- Processor logs per item (non-verbose):
  - Success: `[Sentiment] OK [i/N] id=… label=… score=… latencyMs=… tokens=…`
  - Failure: `[Sentiment] FAIL [i/N] id=… code=… msg=…`

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `INTERNAL_API_KEY` | Recommended | API key for authenticating manual API calls (Vercel Cron bypasses this) |
| `VERCEL_ENV` | Auto-set | Vercel environment (production/preview/development) - used for error message sanitization |

### Processing Configuration

Default settings in `SentimentProcessorJob.ts`:
- **Batch Size**: 10 tweets per run
- **Model Version**: `gemini-2.0-flash-exp`
- **Max Retries**: 2 attempts per tweet with exponential backoff and jitter
- **Timeout**: 30 seconds per API call
- **Rate Limit Delay**: 4 seconds between requests (15 RPM compliance)

## Gemini API Integration

### Model Selection

**Recommended**: `gemini-2.0-flash-lite`
- Fast responses (~1-2s per tweet)
- Cost-effective for high volume
- Structured JSON output support

### Prompt Engineering

The system uses structured prompts with:
- Clear sentiment definitions (positive/neutral/negative)
- Context about coding agents domain
- JSON schema enforcement
- Score normalization (-1.0 to 1.0)

### Rate Limits

**Free Tier:**
- 15 RPM (Requests Per Minute)
- 1.5M tokens per day
- Sufficient for ~1,500 tweets/day

**Paid Tier:**
- Higher RPM limits
- Contact Google Cloud for enterprise quotas

### Error Handling

**Retryable Errors:**
- Rate limit (429)
- Server errors (5xx)
- Timeout errors

**Non-Retryable Errors:**
- Invalid API key (401)
- Malformed response
- JSON parsing errors

## Database Schema

### tweet_sentiments

Stores successful sentiment analysis results:
- `normalized_tweet_id`: FK to normalized_tweets
- `sentiment_label`: 'positive' | 'neutral' | 'negative'
- `sentiment_score`: numeric(-1.0 to 1.0)
- `reasoning`: JSONB with summary
- `latency_ms`: API response time
- `model_version`: Gemini model used

### sentiment_failures

Records processing failures for replay:
- `normalized_tweet_id`: FK to normalized_tweets
- `error_code`: Classification of error
- `error_message`: Detailed error description
- `retry_count`: Number of attempts
- `payload`: Context for debugging

## Monitoring

### Key Metrics

- **Processing Rate**: Tweets processed per minute
- **Success Rate**: Successful / Total processed
- **Latency**: Average API response time
- **Token Usage**: Total tokens consumed
- **Error Rate**: Failures by error code

### Cost Tracking

Token usage is logged with each request:
```typescript
{
  prompt: 45,      // Input tokens
  completion: 23,  // Output tokens
  total: 68        // Sum
}
```

Estimate costs:
- Free tier: First 1.5M tokens/day free
- Paid tier: ~$0.075 per 1M tokens (varies by model)

## Operational Guidelines

### Daily Processing

1. **Cron Schedule**: Process sentiments every 30 minutes (configured in `vercel.json`)
2. **Batch Size**: Default 10, configured with rate limiting (4s delay between requests)
3. **Monitoring**: Check `sentiment_failures` table daily
4. **Authentication**: Cron requests automatically authenticated via Vercel header

### Failure Recovery

1. **Automatic Retry**: Up to 3 attempts with backoff
2. **Manual Replay**: Use `replay:sentiments` script
3. **Investigation**: Check `sentiment_failures.error_message`

### Scaling Considerations

- **Increase Batch Size**: When under rate limits
- **Parallel Processing**: Split by keyword or language
- **Model Upgrade**: Consider Pro version for complex cases

## Testing

### Unit Tests

```bash
npm test -- promptTemplate.test.ts
```

### Integration Testing

```bash
# Test with mock API (requires GEMINI_API_KEY)
curl -X POST http://localhost:3000/api/process-sentiments \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 1}'
```

### Load Testing

Before production:
1. Mock Gemini responses to test throughput
2. Verify rate limit handling with real API
3. Test failure recovery with forced errors

## Future Enhancements

- **Streaming Processing**: Real-time sentiment as tweets arrive
- **Multi-Model Ensemble**: Compare Gemini with other providers
- **Fine-Tuned Models**: Custom model for coding agent domain
- **Sentiment Trends**: Real-time aggregation and alerting
- **Advanced Analytics**: Entity extraction, topic modeling

## References

- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Structured Output Guide](https://ai.google.dev/gemini-api/docs/structured-output)
- [Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing)

# Sentiment Processing Mini-Plan

Goal
- Process `normalized_tweets` with `status='pending_sentiment'` in small, configurable batches and persist results in `tweet_sentiments`, marking tweets `processed` on success and `failed` on terminal errors. No Edge Function changes.

Scope
- Standalone npm script reads `NUMBER_OF_PENDING_TWEETS` to set batch size (clamped 1..25) and runs the local job path (not the Edge Function).
- Uses existing slice logic and repositories; respects rate limits and retry semantics already implemented.

Progress
- [x] Review pipeline scripts to mirror naming conventions (enqueue/process/cleanup).
- [x] Add script `npm run process:sentiments` with `NUMBER_OF_PENDING_TWEETS` (optional `SENTIMENT_MAX_RETRIES`, `SENTIMENT_MODEL_VERSION`).
- [ ] Smoke test locally with a small batch (e.g., 1–3) and real `GEMINI_API_KEY`.
- [ ] Document success in `docs/apify-pipeline/local-testing-guide.md` and update `src/ApifyPipeline/Docs/sentiment-processing.md` if needed.

How To Run (local)
- Ensure env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` available (e.g., `.env.local`).
- Set batch size: `NUMBER_OF_PENDING_TWEETS=5`
- Run: `npm run process:sentiments`
- Expected:
  - On success: `normalized_tweets.status` → `processed`, new rows in `tweet_sentiments`, `vw_daily_sentiment` reflects updates automatically.
  - On failure: insert into `sentiment_failures`; terminal errors set `status='failed'`.

Notes
- This script mirrors existing patterns (`process:backfill`) and keeps sentiment processing decoupled from Edge Function flow for local/manual runs.

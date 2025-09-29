# Gemini Sentiment Verification — 2025-09-29

## Key Findings
- **Gemini model availability:** The Gemini 2.5 family (Pro, Flash, Flash-Lite) remains generally available to developers with clearly documented token pricing and rate limits as of 27–25 September 2025. Free-tier usage is limited to generous but finite RPM/RPD caps; production workloads require upgrading to higher tiers or paid plans depending on throughput needs. [Google Pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- **Sentiment workflow:** Google does not expose a standalone “Sentiment API.” Sentiment categorisation is achieved by prompting Gemini models (for example `gemini-2.5-flash`) with structured-output or enum schemas so the response is constrained to labels such as positive/neutral/negative. Official guidance highlights enum-based classification for deterministic outputs. [Structured Output Guide](https://ai.google.dev/gemini-api/docs/structured-output)
- **Model lifecycle:** Google is retiring every Gemini 1.5 model on 24 September 2025. Any documentation should steer teams toward 2.5-series models (Flash/Flash-Lite for cost-sensitive work, Pro for higher reasoning). [Firebase AI Logic Notice](https://firebase.google.com/docs/ai-logic)
- **Vertex AI alignment:** Vertex AI deprecated AutoML Text custom sentiment objectives and directs customers to Gemini tuning/commanding flows instead, reinforcing the shift to Gemini for classification. [Vertex AI Deprecations](https://cloud.google.com/vertex-ai/docs/deprecations)
- **Production example:** Google Cloud demonstrates sentiment classification of customer reviews inside BigQuery using Gemini remote models, confirming viability of text sentiment classification with prompt templates. [BigQuery Sentiment Blog](https://cloud.google.com/blog/products/data-analytics/using-gemini-in-bigquery-for-sentiment-analysis)

## Serverless Integration Guidance
- **Supabase Edge Functions:** Official docs recommend Edge Functions for “small AI inference tasks or orchestrating calls to external LLM APIs (like OpenAI),” confirming the pattern of invoking Gemini server-side from Supabase. [Supabase Functions Overview](https://supabase.com/docs/guides/functions)
- **Vercel functions / SDK:** Google’s Vercel AI SDK example shows a TypeScript service calling Gemini (with Google Search tool) and is designed for Node/Next.js environments typically deployed on Vercel’s serverless platform. [Vercel AI SDK Example](https://ai.google.dev/gemini-api/docs/vercel-ai-sdk-example)

## Alternative Google Services
- **Natural Language API:** Still positioned for turnkey sentiment analysis without custom prompting; may suit simpler classification workloads while Gemini handles nuanced, multi-label or multimodal use cases. [Cloud Natural Language](https://cloud.google.com/natural-language)
- **Vertex AI BigQuery Integration:** BigQuery ML `ML.GENERATE_TEXT` with Gemini remote models enables SQL-first sentiment pipelines; teams needing tighter GCP integration or governance can evaluate this over Supabase/Vercel triggers. [BigQuery Sentiment Blog](https://cloud.google.com/blog/products/data-analytics/using-gemini-in-bigquery-for-sentiment-analysis)

## Documentation Update Recommendations
1. **overview.md (Step 5)** — Replace “Gemini Sentiment-Analyse” phrasing with “Gemini API sentiment classification using `gemini-2.5-flash` (or `flash-lite` for cost-sensitive batches)” and note there is no dedicated Sentiment endpoint; the workflow uses structured prompts.
2. **specification.md §3.4 & §7** — Reword “Gemini Sentiment API” to “Gemini API classification call” and explicitly mention structured-output (enum labels) plus retry logic aligned with Free vs Tier 1 limits. Cite current RPM/RPD numbers to justify batching or queueing when volume grows.
3. **specification.md §5 & §8** — Document secret management expectations (Gemini API key stored in Supabase Secrets / Vercel env vars) and flag the 1.5 retirement deadline so deployments pin to 2.5-series models.
4. **Add operational note** — Summarise token pricing and free-tier quotas so stakeholders budget Supabase trigger throughput and understand when Tier upgrades are required.
5. **Highlight alternatives** — Briefly cross-reference Google Cloud Natural Language or Vertex AI BigQuery ML for teams already on GCP that might prefer managed sentiment APIs over custom prompt engineering.

Updating the docs with the above clarifications keeps the architecture accurate, acknowledges current platform limits, and points readers to sustainable model choices for late 2025.

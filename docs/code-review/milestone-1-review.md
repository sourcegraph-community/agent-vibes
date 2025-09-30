# Milestone 1: Supabase Schema & Data Access - Code Review Report

**Reviewer:** Amp AI Assistant  
**Review Date:** September 30, 2025  
**Milestone:** Sprint 1 (Weeks 3–4) - Supabase Schema & Data Access  
**Status:** ✅ **APPROVED WITH MINOR RECOMMENDATIONS**

---

## Executive Summary

Milestone 1 has been successfully implemented with high quality and adherence to project requirements. The implementation demonstrates strong alignment with Vertical Slice Architecture (VSA) principles, data-first design philosophy, and the specification requirements. All critical deliverables are present and functional.

**Overall Grade:** A- (93/100) - *Updated after schema prefix fix*

### Key Achievements
- ✅ Complete Supabase schema with all required tables and constraints
- ✅ Append-only enforcement via triggers across all data tables
- ✅ Row Level Security (RLS) policies implemented for dashboard access
- ✅ Analytical views (`vw_daily_sentiment`, `vw_keyword_trends`) with proper aggregations
- ✅ Comprehensive seed data for testing and validation
- ✅ Secret rotation script with production-ready error handling
- ✅ Proper indexing strategy for query optimization
- ✅ Clean separation of concerns following VSA patterns

### Areas for Improvement
- Documentation of RLS testing procedures
- Migration rollback strategy documentation
- Performance benchmarks for views under load
- Additional edge case handling in rotation script

---

## Detailed Review by Component

### 1. Database Schema Migration (`20250929_1200_InitApifyPipeline.sql`)

**Grade:** A (95/100)

#### Strengths

**Schema Design Excellence:**
- All six core tables properly defined with appropriate data types
- Excellent use of PostgreSQL-specific features:
  - Custom ENUM types (`normalized_tweet_status`, `cron_run_status`)
  - UUID primary keys with `gen_random_uuid()`
  - Foreign key constraints with `ON DELETE RESTRICT` for referential integrity
  - CHECK constraints for data validation (counts >= 0, scores between -1 and 1)
- Proper timestamp management with `timestamptz` for timezone awareness

**Append-Only Architecture:**
```sql
create or replace function public.enforce_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Append-only table "%": % operations are not permitted', TG_TABLE_NAME, TG_OP;
end;
$$;
```
- Excellent implementation preventing UPDATE and DELETE operations
- Applied consistently across all data tables (6 triggers)
- Clear error messages referencing table and operation
- Aligns perfectly with data lineage requirements from specification

**Automatic Timestamp Management:**
- Three specialized trigger functions for different timestamp patterns:
  - `set_ingestion_timestamps()` - for raw tweets
  - `set_status_changed_at()` - for normalized tweets with status tracking
  - `set_processed_at()` - for sentiment results
- Idempotent design: only sets values if NULL
- Reduces human error in application code

**Indexing Strategy:**
```sql
create index if not exists idx_cron_runs_started_at on public.cron_runs (started_at desc);
create index if not exists idx_raw_tweets_run_platform on public.raw_tweets (run_id, platform);
create index if not exists idx_normalized_tweets_platform_id on public.normalized_tweets (platform, platform_id, revision desc);
create index if not exists idx_normalized_tweets_posted_at on public.normalized_tweets (posted_at desc);
create index if not exists idx_tweet_sentiments_normalized on public.tweet_sentiments (normalized_tweet_id, processed_at desc);
create index if not exists idx_sentiment_failures_normalized on public.sentiment_failures (normalized_tweet_id, last_attempt_at desc);
create index if not exists idx_keywords_enabled_priority on public.keywords (is_enabled, priority);
```
- Composite indexes for common query patterns
- DESC ordering for time-series queries (recent-first)
- Compound index on `keywords` for filtering and sorting
- All indexes use `IF NOT EXISTS` for idempotent migrations

**Analytical Views:**

`vw_daily_sentiment`:
```sql
create or replace view public.vw_daily_sentiment as
with sentiment_data as (
  select
    nt.id as normalized_tweet_id,
    date_trunc('day', nt.posted_at) as sentiment_day,
    coalesce(nullif(nt.language, ''), 'unknown') as language,
    ts.sentiment_label,
    ts.sentiment_score
  from public.normalized_tweets nt
  left join public.tweet_sentiments ts on ts.normalized_tweet_id = nt.id
)
select
  sentiment_day,
  language,
  count(*) filter (where sentiment_label = 'positive') as positive_count,
  count(*) filter (where sentiment_label = 'neutral') as neutral_count,
  count(*) filter (where sentiment_label = 'negative') as negative_count,
  count(*) as total_count,
  avg(sentiment_score) as avg_sentiment_score
from sentiment_data
where sentiment_day is not null
group by sentiment_day, language
order by sentiment_day desc, language;
```
- Excellent use of CTEs for readability
- `FILTER` clause for conditional aggregation (PostgreSQL-specific)
- Proper handling of NULL language values with `COALESCE(NULLIF(...))`
- LEFT JOIN preserves tweets without sentiment analysis
- Time truncation to day for aggregation

`vw_keyword_trends`:
- Uses `CROSS JOIN LATERAL UNNEST()` to expand keyword arrays
- Proper normalization with `lower(trim(keyword))`
- Aggregates by day and keyword for trend analysis
- Includes negative sentiment tracking and average scores

**Row Level Security:**
```sql
create or replace function public.dashboard_role()
returns text
language plpgsql
stable
as $$
declare
  claims jsonb;
begin
  begin
    claims := current_setting('request.jwt.claims', true)::jsonb;
  exception when others then
    claims := '{}'::jsonb;
  end;
  return coalesce(claims ->> 'app_role', '');
end;
$$;

create policy if not exists normalized_tweets_dashboard_read
  on public.normalized_tweets
  for select
  using (public.dashboard_role() = 'dashboard');
```
- RLS enabled on sensitive tables
- Custom function for role extraction from JWT
- Safe error handling with exception block
- Read-only policies for dashboard access
- `STABLE` function modifier for performance optimization

**Transaction Safety:**
- Proper `BEGIN`/`COMMIT` wrapping
- All operations execute atomically
- Idempotent with `IF NOT EXISTS` clauses

#### Areas for Improvement

1. **Missing Rollback Script** (Minor)
   - No documented rollback/down migration
   - Recommendation: Create companion `20250929_1200_InitApifyPipeline_rollback.sql`
   ```sql
   -- Suggested rollback structure:
   BEGIN;
   DROP POLICY IF EXISTS tweet_sentiments_dashboard_read ON public.tweet_sentiments;
   DROP POLICY IF EXISTS normalized_tweets_dashboard_read ON public.normalized_tweets;
   DROP VIEW IF EXISTS public.vw_keyword_trends;
   DROP VIEW IF EXISTS public.vw_daily_sentiment;
   -- ... (drop tables in reverse dependency order)
   COMMIT;
   ```

2. **RLS Policy Coverage** (Minor)
   - Only `normalized_tweets` and `tweet_sentiments` have RLS
   - Consider if `cron_runs` should have RLS for operational security
   - Other tables (`raw_tweets`, `sentiment_failures`) may need policies depending on access patterns

3. **View Performance Considerations** (Documentation)
   - No discussion of materialized views for high-volume scenarios
   - `vw_daily_sentiment` could be materialized if query performance degrades
   - Recommendation: Document threshold for materialization (e.g., >100K tweets)

4. **Missing Comments** (Minor)
   - No PostgreSQL `COMMENT ON` statements for tables/columns
   - Would improve self-documentation for DBAs and future developers

5. **Constraint Naming Convention** (Stylistic)
   - Some constraints use default names (e.g., foreign keys)
   - Explicit naming improves debugging: `CONSTRAINT fk_raw_tweets_run_id FOREIGN KEY ...`

---

### 2. Seed Data (`20250929_1230_KeywordsSeed.sql`)

**Grade:** A+ (98/100)

#### Strengths

**Keyword Management:**
```sql
insert into public.keywords (keyword, is_enabled, priority, source, note)
values
  ('agentic ai', true, 10, 'analytics', 'Core campaign keyword'),
  ('prompt engineering', true, 20, 'analytics', 'High-signal technique discussions'),
  ('autonomous agents', true, 30, 'analytics', 'Track broader agent discourse'),
  ('workflow automation', false, 40, 'analytics', 'Secondary focus – keep disabled until Q4'),
  ('multi-agent systems', true, 30, 'analytics', 'Monitor academic/research mentions')
on conflict (keyword) do update set
  is_enabled = excluded.is_enabled,
  priority = excluded.priority,
  source = excluded.source,
  note = excluded.note,
  last_used_at = case when excluded.is_enabled then now() else public.keywords.last_used_at end;
```
- Proper use of `ON CONFLICT` for upsert semantics
- Preserves `last_used_at` for disabled keywords
- Clear ownership attribution (`source = 'analytics'`)
- Priority system for batching (10-40 range)
- Descriptive notes for each keyword's purpose

**Demo Data Strategy:**
```sql
-- Note: Fixed UUIDs (11111111-..., 22222222-..., etc.) are used intentionally for:
--   1. Deterministic testing - same IDs across environments for test validation
--   2. Idempotent re-seeding - 'on conflict do nothing' prevents duplicate errors
--   3. Foreign key references - normalized_tweets and sentiments reference these stable IDs
-- This is safe because seed data is demo/test content only, never production data.
```
- **Excellent documentation** explaining the fixed UUID strategy
- Addresses potential security concerns upfront
- Enables deterministic testing across environments
- Makes foreign key relationships explicit

**Realistic Sample Data:**
- Two complete tweet examples with:
  - Realistic Twitter usernames and display names
  - Proper URL format
  - Credible engagement metrics (likes: 89-128, retweets: 22-34)
  - Keyword associations matching the seeded keywords
  - Sentiment scores in valid range (0.64-0.71)
  - Model version tracking (`gemini-2.5-flash:2025-09-15`)

**CTE-Based Approach:**
```sql
with seed_run as (
  insert into public.cron_runs (...)
  values (...)
  on conflict (id) do nothing
  returning id
), run_id as (
  select coalesce((select id from seed_run), '11111111-1111-4111-8111-111111111111'::uuid) as id
)
insert into public.normalized_tweets (...)
select ... from run_id r cross join lateral (...) as s(...)
on conflict (platform, platform_id, revision) do nothing;
```
- Idempotent: can be run multiple times safely
- Uses `RETURNING` to capture inserted ID
- Fallback to hardcoded UUID if row already exists
- `CROSS JOIN LATERAL` for parameterized values

**Data Completeness:**
- All required fields populated
- Proper timestamp relationships (collected_at < posted_at)
- Status set to `processed` to populate views
- `model_context` JSONB includes metadata

#### Areas for Improvement

1. **Seed Data Volume** (Enhancement)
   - Only 2 sample tweets
   - Views would benefit from 10-20 tweets spanning multiple days
   - Current data insufficient to test daily trends over time
   - Recommendation: Add function to generate additional seed data

2. **Language Diversity** (Enhancement)
   - All seed tweets in English
   - Specification mentions `de` (German) as secondary language
   - Add at least one German tweet to test language filtering

3. **Negative Sentiment Missing** (Testing Gap)
   - Both sample tweets are positive (0.64, 0.71)
   - No neutral or negative examples
   - Dashboard visualization can't demonstrate full sentiment distribution
   - Add tweets covering all three sentiment labels

4. **Failure Scenario Seeds** (Testing Gap)
   - No entries in `sentiment_failures` table
   - Can't validate failure tracking without sample data
   - Recommendation: Add 1-2 failure examples with different error types

---

### 3. Secret Rotation Script (`rotate-supabase-secrets.ts`)

**Grade:** A (94/100)

#### Strengths

**Production-Grade Error Handling:**
```typescript
class RotationError extends Error {}

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new RotationError(`${name} must be set`);
  }
  return value;
};
```
- Custom error class for clear error identification
- Required environment variables validated upfront
- Fail-fast approach prevents partial operations

**Comprehensive CLI Arguments:**
```typescript
type ParsedArgs = {
  dryRun: boolean;      // Safety preview mode
  ci: boolean;          // CI/CD environment handling
  keepOld: boolean;     // Preserve old keys during rotation
  envFiles: string[];   // Target .env files
  outputFiles: string[]; // Append-only output files
};
```
- `--dry-run` for safe testing (excellent safety feature)
- `--ci` mode skips default `.env.local` files
- `--keep-old` for gradual rollout scenarios
- Flexible file targeting via `--env-file` and `--output`

**Secure API Communication:**
```typescript
const fetchJson = async <T>(input: string, init: RequestInit & { accessToken: string }): Promise<T | undefined> => {
  const { accessToken, ...rest } = init;
  const headers = new Headers(rest.headers ?? {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');
  
  if (rest.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, { ...rest, headers });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body.error === 'string') {
        message += `: ${body.error}`;
      } else if (typeof body.message === 'string') {
        message += `: ${body.message}`;
      }
    } catch (error) {
      // ignore body parsing issues to avoid masking the original error
    }
    throw new RotationError(message);
  }

  const text = await response.text();
  if (!text) return undefined;

  return JSON.parse(text) as T;
};
```
- Generic type parameter for type safety
- Proper header management
- Enhanced error messages with API response details
- Silent fallback on error detail parsing (prevents error masking)
- Handles empty responses gracefully

**Atomic Rotation Process:**
1. Create new service role key
2. Store in Supabase secrets (`sb_secret_service_role`)
3. Update local environment files
4. Delete old keys (optional, if `--keep-old` not set)
5. Report results

Order ensures new key is always available before old is removed.

**File Operations:**
```typescript
const upsertEnvFile = async (filePath: string, key: string, value: string) => {
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(filePath, `${key}=${value}\n`, { mode: 0o600 });
      return;
    }
    throw error;
  }

  const lines = content.split(/\r?\n/);
  let replaced = false;

  const updated = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      replaced = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!replaced) {
    updated.push(`${key}=${value}`);
  }

  await fs.writeFile(filePath, `${updated.filter(Boolean).join('\n')}\n`, { mode: 0o600 });
};
```
- Creates file with secure permissions (0o600 = owner read/write only)
- Handles missing files gracefully
- Updates existing keys in-place
- Appends if key doesn't exist
- Preserves file structure
- Cross-platform line ending handling (`/\r?\n/`)

**Smart Path Handling:**
```typescript
const uniqueResolved = (paths: string[]) => {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const path of paths) {
    const absolute = resolve(path);
    if (seen.has(absolute)) {
      continue;
    }
    seen.add(absolute);
    results.push(absolute);
  }
  return results;
};
```
- Resolves to absolute paths
- Deduplicates targets (prevents double writes)
- Handles multiple sources: args, env vars, defaults

**Dry Run Feature:**
```typescript
if (args.dryRun) {
  console.log(`Dry run: would rotate service role key for project ${projectRef}.`);
  console.log(`Dry run: identified ${serviceRoleKeys.length} existing service role keys.`);
  if (!args.keepOld) {
    console.log('Dry run: would delete existing service role keys after creating the new key.');
  }
  // ... more dry run output
  return;
}
```
- Clear "would do X" language
- Describes all operations without executing them
- Essential safety feature for production operations

**Type Safety:**
```typescript
type ApiKeyRecord = {
  id: string;
  type: string;
  api_key?: string;
  name?: string;
  description?: string;
  inserted_at?: string;
  updated_at?: string;
};
```
- Explicit types for Supabase API responses
- Optional fields properly marked
- Enables compile-time validation

#### Areas for Improvement

1. **Limited Scope** (Enhancement)
   - Script only rotates `SUPABASE_SERVICE_ROLE_KEY`
   - Spec mentions multiple secrets: `GEMINI_API_KEY`, `APIFY_TOKEN`, `VAPID_PRIVATE_KEY`
   - Recommendation: Extend to rotate all critical secrets or create similar scripts

2. **No Backup Mechanism** (Risk)
   - Old keys deleted immediately (unless `--keep-old`)
   - If new key is malformed or sync fails to all services, rollback is difficult
   - Recommendation: Add `--backup-file` option to save old keys before deletion
   ```typescript
   if (args.backupFile) {
     await appendOutputFile(args.backupFile, `${ENV_KEY}_OLD`, oldKey.api_key);
   }
   ```

3. **Missing Validation** (Edge Case)
   - No verification that new key works before deleting old keys
   - Recommendation: Test new key with simple Supabase query before cleanup
   ```typescript
   const testNewKey = async (key: string) => {
     const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
       headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
     });
     if (!response.ok) throw new Error('New key validation failed');
   };
   ```

4. **Package.json Integration** (Documentation)
   - Script registered as `npm run rotate:supabase`
   - No documentation of required environment variables in script help text
   - Recommendation: Add `--help` flag with usage examples

5. **Logging vs. Security** (Minor)
   - No structured logging for audit trail
   - Good: Keys never logged to console
   - Enhancement: Optional JSON output mode for audit logging (without secrets)

---

## Architecture & VSA Compliance

**Grade:** A+ (97/100)

### Slice Organization

The implementation perfectly follows Vertical Slice Architecture as documented:

```
src/ApifyPipeline/
├── Background/           # Time-triggered jobs (future)
├── Core/                 # Pure business logic (future)
├── DataAccess/          # ✅ Database layer
│   ├── Migrations/      # ✅ Schema definitions
│   ├── Seeds/           # ✅ Test data
│   ├── Repositories/    # ✅ Data access patterns
│   └── Queries/         # ✅ View helpers
├── Docs/                # ✅ Documentation
├── ExternalServices/    # External integrations (future)
├── Infrastructure/      # Shared utilities (future)
├── Tests/               # Testing (future)
└── Web/                 # API endpoints (future)
```

**Strengths:**
- Clean separation of migrations, seeds, repositories, and queries
- Naming convention follows `yyyyMMdd_HHmm_Description.sql` spec
- All database concerns isolated within `DataAccess/` directory
- Self-contained: no external dependencies on other slices
- README.md documents ownership, rotation schedule, and operational contacts

**VSA Principles Applied:**
1. **Feature Ownership**: Database schema owned entirely by ApifyPipeline slice
2. **Vertical Integration**: All database concerns (schema, seeds, access) in one location
3. **Explicit Contracts**: Views serve as contracts for dashboard consumers
4. **Minimal Coupling**: RLS policies define clear access boundaries

---

## Data-First Design Compliance

**Grade:** A (96/100)

The implementation strongly adheres to the documented data-first philosophy:

### Primary Storage Design
✅ **Append-Only Architecture**: All six tables enforce immutability via triggers  
✅ **Lineage Tracking**: `run_id` foreign keys connect data to collection events  
✅ **Metadata Preservation**: `model_version`, `revision`, `ingestion_reason` fields  
✅ **Audit Trail**: Timestamp fields (`created_at`, `ingested_at`, `processed_at`)

### Derived Artifacts
✅ **Analytical Views**: `vw_daily_sentiment` and `vw_keyword_trends` implemented  
✅ **Aggregation Logic**: Proper use of PostgreSQL filter clauses and CTEs  
✅ **Data Provenance**: Sentiment linked to `model_version` for reproducibility

### Operational Metadata
✅ **Run Statistics**: `cron_runs` captures counts (new/duplicate/error)  
✅ **Failure Tracking**: `sentiment_failures` with retry counts and payloads  
✅ **Status Management**: ENUM types enforce valid state transitions

---

## Specification Compliance

**Grade:** A (95/100)

### Requirements Met

| Requirement | Status | Evidence |
|------------|--------|----------|
| Six core tables | ✅ Complete | `cron_runs`, `raw_tweets`, `normalized_tweets`, `tweet_sentiments`, `sentiment_failures`, `keywords` |
| Append-only enforcement | ✅ Complete | Triggers on all 6 tables |
| Status ENUM types | ✅ Complete | `normalized_tweet_status`, `cron_run_status` |
| Foreign key constraints | ✅ Complete | All relationships with `ON DELETE RESTRICT` |
| CHECK constraints | ✅ Complete | Counts >= 0, scores between -1 and 1 |
| Timestamp automation | ✅ Complete | Three trigger functions |
| Indexes for performance | ✅ Complete | 7 indexes covering common queries |
| Analytical views | ✅ Complete | `vw_daily_sentiment`, `vw_keyword_trends` |
| RLS policies | ✅ Complete | Dashboard read-only access |
| Seed data | ✅ Complete | Keywords + demo tweets + sentiments |
| Secret rotation | ✅ Complete | TypeScript script via Management API |
| Documentation | ✅ Complete | README with ownership and processes |

### Requirements Not Yet Applicable (Future Milestones)
- Supabase Edge Functions (Milestone 3)
- Vercel Cron integration (Milestone 2)
- Dashboard UI (Milestone 4)
- Monitoring/alerting (Milestone 5)

---

## Security Review

**Grade:** A- (92/100)

### Strengths

**Secrets Management:**
- Script uses `SUPABASE_ACCESS_TOKEN` from environment (not hardcoded)
- Keys stored in `sb_secret_*` namespace per Supabase best practices
- File permissions set to 0o600 (owner-only access)
- No secrets logged to console or files

**Database Security:**
- RLS enabled on `normalized_tweets` and `tweet_sentiments`
- JWT-based role extraction with safe defaults
- Foreign keys prevent orphaned records
- Append-only prevents accidental data loss

**API Security:**
- Bearer token authentication
- HTTPS enforced via Supabase API base URL
- Error messages don't leak sensitive data

### Concerns

1. **RLS Coverage** (Medium)
   - `cron_runs` contains operational metadata but no RLS
   - `raw_tweets` accessible without role check
   - May be acceptable if service role is properly scoped
   - Recommendation: Document security model explicitly

2. **Rotation Gap Period** (Low)
   - Brief window where both old and new keys are valid
   - Acceptable for most use cases but should be documented
   - Consider `--keep-old` for zero-downtime rotations

3. **No Encryption at Rest Discussion** (Documentation)
   - Relies on Supabase platform encryption
   - No mention of additional encryption for sensitive fields
   - Recommendation: Document data classification and encryption strategy

---

## Testing & Validation

**Grade:** B+ (88/100)

### What's Provided

**Seed Data for Validation:**
- Demo `cron_run` with realistic metrics
- Two normalized tweets with complete metadata
- Two sentiment results with model versions
- Enables manual validation of views

**Idempotent Migrations:**
- All DDL uses `IF NOT EXISTS` / `CREATE OR REPLACE`
- Can be run multiple times safely
- Important for CI/CD pipelines

### What's Missing

1. **No Automated Tests** (Significant Gap)
   - No unit tests for trigger functions
   - No integration tests for RLS policies
   - No validation tests for views
   - Recommendation: Add tests in `src/ApifyPipeline/Tests/Integration/DataAccess/`

2. **No Load Testing** (Future Concern)
   - Views not tested with realistic data volumes
   - Index effectiveness unverified
   - Recommendation: Generate 100K+ rows and measure query performance

3. **No RLS Test Cases** (Security Gap)
   - No verification that RLS blocks unauthorized access
   - No test for different JWT claim scenarios
   - Recommendation: Add test suite with multiple roles

4. **No Rollback Validation** (Operational Gap)
   - No documented rollback procedure
   - No test of rolling back migration
   - Critical for production confidence

**Recommended Test Structure:**
```typescript
// src/ApifyPipeline/Tests/Integration/DataAccess/schema.test.ts
describe('Schema Validation', () => {
  it('should enforce append-only on cron_runs', async () => {
    const inserted = await insertCronRun(testData);
    await expect(updateCronRun(inserted.id, { status: 'failed' }))
      .rejects.toThrow(/Append-only table/);
  });

  it('should prevent negative engagement counts', async () => {
    await expect(insertNormalizedTweet({ engagement_likes: -5 }))
      .rejects.toThrow(/violates check constraint/);
  });

  it('vw_daily_sentiment should aggregate correctly', async () => {
    const results = await queryView('vw_daily_sentiment');
    expect(results[0].total_count).toBe(results[0].positive_count + ...);
  });

  it('RLS should block access without dashboard role', async () => {
    const clientWithoutRole = createSupabaseClient({ role: 'anon' });
    const { data, error } = await clientWithoutRole
      .from('normalized_tweets')
      .select('*');
    expect(data).toHaveLength(0);
  });
});
```

---

## Documentation Quality

**Grade:** A- (93/100)

### Strengths

**In-SQL Comments:**
- Excellent comment explaining fixed UUID strategy in seed file
- Justification for design decisions
- Warning about production vs. demo data

**README.md:**
- Clear ownership attribution (Analytics Guild)
- Secret rotation process documented
- Contact channels specified (#ops-oncall, #backend-support)
- Links to operational runbook

**Code Documentation:**
- TypeScript types are self-documenting
- Function names are descriptive
- Error messages are clear and actionable

### Improvements Needed

1. **Migration Documentation** (Missing)
   - No header comment explaining purpose
   - No reference to specification sections
   - No changelog tracking what changed from draft

2. **View Query Documentation** (Light)
   - Complex CTEs lack inline comments
   - No explanation of business logic in aggregations
   - Recommendation: Add comments for each CTE and aggregation

3. **Secret Rotation Examples** (Missing)
   - No example command with all flags
   - No troubleshooting guide
   - Recommendation: Add to README or runbook

4. **Performance Characteristics** (Missing)
   - No documentation of expected query times
   - No guidance on when to materialize views
   - No index usage explanations

---

## Performance Considerations

**Grade:** B+ (87/100)

### Optimizations Present

**Indexing:**
- Covering indexes for foreign key lookups
- DESC ordering for time-series queries
- Composite indexes for multi-column filters

**View Design:**
- CTEs for query readability and planning
- Aggregate pushdown via WHERE clauses
- LEFT JOINs preserve unprocessed tweets

**Trigger Efficiency:**
- Minimal logic (timestamp setting only)
- No expensive operations in critical path

### Potential Issues

1. **View Performance Under Load** (Future Concern)
   - `vw_daily_sentiment` scans entire `normalized_tweets` table
   - No date range filtering in view definition
   - With 1M+ tweets, query could be slow
   - **Recommendation**: Add WHERE clause or materialize
   ```sql
   -- Add to view definition:
   WHERE nt.posted_at >= NOW() - INTERVAL '90 days'
   ```

2. **Keyword Array UNNEST** (Moderate Concern)
   - `vw_keyword_trends` uses `CROSS JOIN LATERAL UNNEST`
   - Each tweet expanded to N rows (N = keyword count)
   - Could be expensive with many keywords per tweet
   - **Recommendation**: Monitor query plans, consider GIN index on `keyword_snapshot`
   ```sql
   CREATE INDEX idx_keyword_snapshot_gin ON public.normalized_tweets 
   USING GIN (keyword_snapshot);
   ```

3. **No Partitioning Strategy** (Future Consideration)
   - Tables will grow indefinitely
   - No mention of archival or partitioning
   - **Recommendation**: Add table partitioning by date after 1M+ rows
   ```sql
   -- Example partitioning by month:
   CREATE TABLE normalized_tweets_2025_10 PARTITION OF normalized_tweets
   FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
   ```

4. **RLS Function Performance** (Minor)
   - `dashboard_role()` marked as `STABLE` (good)
   - But parses JSON on every row
   - **Recommendation**: Consider caching JWT claims in session variable

---

## Code Quality

**Grade:** A (96/100) - *Updated after schema prefix fix*

### TypeScript (Rotation Script)

**Strengths:**
- Strict TypeScript with explicit types
- No `any` types used
- Proper error handling with custom error class
- Async/await throughout (no callback hell)
- Functional decomposition (each function does one thing)
- Type guards for runtime safety (`as NodeJS.ErrnoException`)

**Style Consistency:**
- Consistent naming (camelCase for functions/variables)
- Clear parameter names
- Logical grouping of related functions

### SQL

**Strengths:**
- Consistent formatting and indentation
- Explicit column lists in INSERTs
- Proper use of PostgreSQL features
- Transaction boundaries clearly marked
- Idempotent DDL statements
- ✅ **FIXED:** Schema prefix now 100% consistent (`public.` explicitly specified for extensions)

**Minor Issues:**
- Some long lines (>120 chars) in view definitions
- No SQL formatter evidence (consider pgFormatter or sqlfluff)

**Note:** Schema prefix inconsistency identified in initial review has been resolved. See [milestone-1-schema-prefix-fix.md](file:///home/prinova/CodeProjects/agent-vibes/docs/code-review/milestone-1-schema-prefix-fix.md) for details.

---

## Milestone-Specific Success Criteria

**All criteria from implementation plan met:**

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Supabase tables deployed | ✅ | All 6 tables in migration |
| Append-only triggers present | ✅ | 6 triggers implemented |
| Lineage metadata present | ✅ | `run_id`, `revision`, `model_version` fields |
| Views return sample data | ✅ | Seed data populates views |
| Secrets rotated via script | ✅ | `rotate-supabase-secrets.ts` complete |
| RLS rules for dashboard | ✅ | 2 policies for read-only access |

---

## Risk Assessment

### Low Risks (Mitigated)
- **Data Loss**: Append-only design prevents accidental deletion ✅
- **SQL Injection**: Parameterized queries in future application code (not applicable yet) ✅
- **Schema Drift**: Single source of truth in migration file ✅

### Medium Risks (Require Attention)
- **View Performance**: No load testing yet ⚠️
  - *Mitigation*: Monitor query plans, add date filters, consider materialization
- **RLS Bypass**: Incomplete policy coverage ⚠️
  - *Mitigation*: Audit all tables, document security model
- **Migration Rollback**: No tested rollback procedure ⚠️
  - *Mitigation*: Create and test rollback script

### High Risks (None Identified)
No critical risks detected in Milestone 1 implementation.

---

## Recommendations

### Immediate (Before Milestone 2)

1. **Create Rollback Migration** (High Priority)
   - Write `20250929_1200_InitApifyPipeline_rollback.sql`
   - Test rollback in dev environment
   - Document rollback procedure in README

2. **Add RLS Test Cases** (High Priority)
   - Verify dashboard role can read
   - Verify other roles are blocked
   - Document expected access patterns

3. **Enhance Seed Data** (Medium Priority)
   - Add 10-20 tweets spanning 7 days
   - Include German language tweets
   - Add negative and neutral sentiment examples
   - Add sentiment failure examples

### Short-Term (During Milestone 2-3)

4. **Performance Baseline** (Medium Priority)
   - Generate 100K synthetic rows
   - Measure view query times
   - Document acceptable thresholds
   - Add monitoring alerts

5. **Extend Secret Rotation** (Medium Priority)
   - Support rotating `GEMINI_API_KEY`, `APIFY_TOKEN`
   - Add `--backup-file` option
   - Add key validation before cleanup

6. **Add PostgreSQL Comments** (Low Priority)
   ```sql
   COMMENT ON TABLE normalized_tweets IS 'Normalized social media posts with enrichment metadata';
   COMMENT ON COLUMN normalized_tweets.revision IS 'Version number for same platform_id, supports re-processing';
   ```

### Long-Term (Milestone 4-5)

7. **Materialized View Strategy** (Low Priority)
   - Evaluate if `vw_daily_sentiment` needs materialization
   - Set up refresh schedule if needed
   - Add monitoring for refresh failures

8. **Partitioning Strategy** (Future)
   - Implement monthly partitioning at 1M+ rows
   - Automate partition creation
   - Document archival policy

9. **Comprehensive Test Suite** (Medium Priority)
   - Unit tests for all trigger functions
   - Integration tests for views
   - RLS policy tests
   - Performance regression tests

---

## Comparison to Implementation Plan

### Checklist Status

From [implementation-plan.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/implementation-plan.md#L231-L236):

- [x] **Implement migrations** for core tables + triggers ✅
  - *Delivered*: Complete migration with 6 tables, 9 triggers, 2 views
- [x] **Seed keywords** with Analytics-provided list ✅
  - *Delivered*: 5 keywords with priorities and ownership
- [x] **Create RLS rules** for normalized_tweets and tweet_sentiments ✅
  - *Delivered*: 2 policies with JWT role extraction
- [x] **Script for rotating secrets** via npm command ✅
  - *Delivered*: Full-featured TypeScript script with dry-run mode

### Delivery Notes Validation

From [implementation-plan.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/implementation-plan.md#L241-L244):

✅ Migration provisions tables, triggers, RLS, and views  
✅ Seed hydrates keywords plus demo sentiment data  
✅ `npm run rotate:supabase` rotates credentials without logging values  
✅ All deliverables match the planned scope

---

## Conclusion

**Milestone 1 has been successfully completed with high quality.**

The implementation demonstrates:
- Strong adherence to Vertical Slice Architecture principles
- Data-first design with proper immutability guarantees
- Production-ready secret management
- Clear separation of concerns
- Comprehensive documentation

The team should be commended for:
- Excellent append-only architecture implementation
- Thoughtful use of PostgreSQL features (triggers, RLS, CTEs)
- Production-grade error handling in rotation script
- Clear documentation of design decisions (fixed UUID rationale)

**Recommended Action**: **Approve for Milestone 2 with minor enhancements**

The identified improvements are mostly nice-to-haves and documentation enhancements. None block progress to the next milestone. However, adding the rollback migration and RLS tests would significantly improve operational confidence.

**Next Steps**:
1. Address "Immediate" recommendations (rollback, RLS tests)
2. Schedule performance baseline session
3. Proceed with Milestone 2 (Apify Ingestion Pipeline)

---

## Appendix: Files Reviewed

### SQL Files
- [20250929_1200_InitApifyPipeline.sql](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/DataAccess/Migrations/20250929_1200_InitApifyPipeline.sql) (278 lines)
- [20250929_1230_KeywordsSeed.sql](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql) (185 lines)

### TypeScript Files
- [rotate-supabase-secrets.ts](file:///home/prinova/CodeProjects/agent-vibes/scripts/rotate-supabase-secrets.ts) (310 lines)

### Documentation
- [implementation-plan.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/implementation-plan.md) (Milestone 1 section)
- [specification.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/specification.md) (Data model section)
- [overview.md](file:///home/prinova/CodeProjects/agent-vibes/docs/apify-pipeline/overview.md)
- [README.md](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Docs/README.md)

### Configuration
- [package.json](file:///home/prinova/CodeProjects/agent-vibes/package.json) (rotation script registration)

**Total Lines Reviewed:** ~1,400+ lines of code and documentation

---

**Review Completed:** September 30, 2025  
**Reviewer:** Amp AI Assistant  
**Next Review:** Milestone 2 implementation upon completion

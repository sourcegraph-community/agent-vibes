export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { createSupabaseServerClient } from '@/src/ApifyPipeline/Infrastructure/Config/supabase';
import { DashboardRepository } from '@/src/ApifyPipeline/DataAccess/Repositories/DashboardRepository';

interface TweetListProps {
  searchParams: Promise<{
    language?: string
    sentiment?: string
    keyword?: string
    page?: string
  }>
}

async function TweetList({ filters }: { filters: { language?: string, sentiment?: string, keyword?: string, page?: string } }) {
  const supabase = await createSupabaseServerClient();
  const repo = new DashboardRepository(supabase);

  const page = Number.parseInt(filters.page || '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  const last7 = new Date();
  last7.setDate(last7.getDate() - 7);
  const startDate = last7.toISOString();

  const tweets = await repo.getTweetDetails({
    language: filters.language,
    sentiment: filters.sentiment,
    keyword: filters.keyword,
    startDate,
    limit,
    offset,
  });

  return (
    <div className="space-y-4">
      {tweets.map((tweet) => (
        <div key={tweet.id} className="card-section">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {tweet.authorName && (
                    <span className="font-medium">{tweet.authorName}</span>
                  )}
                  {tweet.authorHandle && (
                    <span className="text-sm text-[var(--muted)]">@{tweet.authorHandle}</span>
                  )}
                  {tweet.language && (
                    <span className="badge-muted inline-flex rounded-full px-2 py-1 text-xs font-medium">
                      {tweet.language}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed">{tweet.content}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tweet.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="inline-flex rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
                  {tweet.postedAt && (
                    <span>{new Date(tweet.postedAt).toLocaleString()}</span>
                  )}
                  {tweet.engagementLikes != null && (
                    <span>❤️ {tweet.engagementLikes}</span>
                  )}
                  {tweet.engagementRetweets != null && (
                    <span>🔄 {tweet.engagementRetweets}</span>
                  )}
                  {tweet.url && (
                    <a
                      href={tweet.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 transition hover:text-blue-300"
                    >
                      View original →
                    </a>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-center">
                {tweet.sentimentLabel && (
                  <div className="space-y-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                        tweet.sentimentLabel === 'positive'
                          ? 'bg-green-500/10 text-green-300'
                          : tweet.sentimentLabel === 'negative'
                            ? 'bg-red-500/10 text-red-300'
                            : 'bg-[color:rgba(255,255,255,0.08)] text-[var(--foreground)]'
                      }`}
                    >
                      {tweet.sentimentLabel}
                    </span>
                    {tweet.sentimentScore != null && (
                      <div className="text-xs text-[var(--muted)]">
                        {tweet.sentimentScore.toFixed(3)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
      {tweets.length === 0 && (
        <div className="card-section px-4 py-12 text-center">
          <p className="text-[var(--muted)]">No tweets found matching your filters</p>
        </div>
      )}
    </div>
  );
}

async function FilterBar({ filters }: { filters: { language?: string, sentiment?: string, keyword?: string } }) {
  const supabase = await createSupabaseServerClient();
  const repo = new DashboardRepository(supabase);

  const availableKeywords = await repo.getAvailableKeywords();

  return (
    <div className="card-section p-4">
      <form method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="language" className="block text-sm font-medium text-[var(--muted)]">
            Language
          </label>
          <select
            id="language"
            name="language"
            defaultValue={filters.language || ''}
            className="mt-1 block w-full rounded-md border border-[var(--surface-border)] bg-[var(--background)] py-2 pl-3 pr-10 text-sm text-[var(--foreground)] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All languages</option>
            <option value="en">English</option>
            <option value="de">German</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </div>

        <div>
          <label htmlFor="sentiment" className="block text-sm font-medium text-[var(--muted)]">
            Sentiment
          </label>
          <select
            id="sentiment"
            name="sentiment"
            defaultValue={filters.sentiment || ''}
            className="mt-1 block w-full rounded-md border border-[var(--surface-border)] bg-[var(--background)] py-2 pl-3 pr-10 text-sm text-[var(--foreground)] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>

        <div>
          <label htmlFor="keyword" className="block text-sm font-medium text-[var(--muted)]">
            Keyword
          </label>
          <select
            id="keyword"
            name="keyword"
            defaultValue={filters.keyword || ''}
            className="mt-1 block w-full rounded-md border border-[var(--surface-border)] bg-[var(--background)] py-2 pl-3 pr-10 text-sm text-[var(--foreground)] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All keywords</option>
            {availableKeywords.map((keyword) => (
              <option key={keyword} value={keyword}>
                {keyword}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent"
          >
            Apply Filters
          </button>
        </div>
      </form>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-[var(--muted)]">Loading...</div>
    </div>
  );
}

export default async function TweetsPage(props: TweetListProps) {
  const searchParams = await props.searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Tweets</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Browse and filter tweets with sentiment analysis
        </p>
      </div>

      <Suspense fallback={<LoadingState />}>
        <FilterBar filters={searchParams} />
      </Suspense>

      <Suspense fallback={<LoadingState />}>
        <TweetList filters={searchParams} />
      </Suspense>
    </div>
  );
}

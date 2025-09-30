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

  const tweets = await repo.getTweetDetails({
    language: filters.language,
    sentiment: filters.sentiment,
    keyword: filters.keyword,
    limit,
    offset,
  });

  return (
    <div className="space-y-4">
      {tweets.map((tweet) => (
        <div key={tweet.id} className="overflow-hidden rounded-lg bg-white shadow">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  {tweet.authorName && (
                    <span className="font-medium text-gray-900">{tweet.authorName}</span>
                  )}
                  {tweet.authorHandle && (
                    <span className="text-sm text-gray-500">@{tweet.authorHandle}</span>
                  )}
                  {tweet.language && (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                      {tweet.language}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-900">{tweet.content}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tweet.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
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
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View original →
                    </a>
                  )}
                </div>
              </div>
              <div className="ml-4 shrink-0">
                {tweet.sentimentLabel && (
                  <div className="text-center">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                        tweet.sentimentLabel === 'positive'
                          ? 'bg-green-100 text-green-800'
                          : tweet.sentimentLabel === 'negative'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {tweet.sentimentLabel}
                    </span>
                    {tweet.sentimentScore != null && (
                      <div className="mt-1 text-xs text-gray-500">
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
        <div className="rounded-lg bg-white px-4 py-12 text-center shadow">
          <p className="text-gray-500">No tweets found matching your filters</p>
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
    <div className="rounded-lg bg-white p-4 shadow">
      <form method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="language" className="block text-sm font-medium text-gray-700">
            Language
          </label>
          <select
            id="language"
            name="language"
            defaultValue={filters.language || ''}
            className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          >
            <option value="">All languages</option>
            <option value="en">English</option>
            <option value="de">German</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </div>

        <div>
          <label htmlFor="sentiment" className="block text-sm font-medium text-gray-700">
            Sentiment
          </label>
          <select
            id="sentiment"
            name="sentiment"
            defaultValue={filters.sentiment || ''}
            className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          >
            <option value="">All sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>

        <div>
          <label htmlFor="keyword" className="block text-sm font-medium text-gray-700">
            Keyword
          </label>
          <select
            id="keyword"
            name="keyword"
            defaultValue={filters.keyword || ''}
            className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
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
            className="w-full rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
      <div className="text-gray-500">Loading...</div>
    </div>
  );
}

export default async function TweetsPage(props: TweetListProps) {
  const searchParams = await props.searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Tweets</h2>
        <p className="mt-1 text-sm text-gray-500">
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

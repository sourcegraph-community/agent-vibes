import { Actor, log } from 'apify';

import type { ApifyTweetItem } from '@/src/ApifyPipeline/Core/Transformations/normalizeTweet';
import { retry } from '@/src/ApifyPipeline/Infrastructure/Utilities/retry';

export interface TwitterScraperConfig {
  keywords: string[];
  tweetLanguage?: string | null;
  sort?: 'Top' | 'Latest';
  maxItemsPerKeyword?: number;
  sinceDate?: string | null;
  untilDate?: string | null;
  minimumEngagement?: {
    retweets?: number;
    favorites?: number;
    replies?: number;
  };
}

export const DEFAULT_TWITTER_SCRAPER_ACTOR = 'apify/twitter-search-scraper';

export const runTwitterScraper = async (
  config: TwitterScraperConfig,
  actorId: string = DEFAULT_TWITTER_SCRAPER_ACTOR,
): Promise<ApifyTweetItem[]> => {
  if (config.keywords.length === 0) {
    return [];
  }

  const run = await retry(
    async () =>
      Actor.call(actorId, {
        searchTerms: config.keywords,
        tweetLanguage: config.tweetLanguage ?? undefined,
        sort: config.sort ?? 'Top',
        maxItems: config.maxItemsPerKeyword,
        includeSearchTerms: true,
        sinceDate: config.sinceDate ?? undefined,
        untilDate: config.untilDate ?? undefined,
        minimumRetweets: config.minimumEngagement?.retweets,
        minimumFavorites: config.minimumEngagement?.favorites,
        minimumReplies: config.minimumEngagement?.replies,
      }),
    { retries: 3, minTimeoutMs: 1000, factor: 2 },
  );

  if (!run?.defaultDatasetId) {
    log.warning('Apify run did not return a dataset.');
    return [];
  }

  const datasetClient = await Actor.openDataset(run.defaultDatasetId);
  const { items } = await datasetClient.getData({
    clean: true,
    limit: config.maxItemsPerKeyword
      ? config.maxItemsPerKeyword * config.keywords.length
      : undefined,
  });

  return (items ?? []) as ApifyTweetItem[];
};

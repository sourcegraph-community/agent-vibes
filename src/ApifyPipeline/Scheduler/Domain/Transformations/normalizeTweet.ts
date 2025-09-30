import type { NormalizedTweetInsert } from '@/src/ApifyPipeline/Scheduler/Domain/Persistence/Repositories/NormalizedTweetsRepository';

export interface ApifyTweetItem {
  id?: string;
  id_str?: string;
  tweetId?: string;
  tweet_id?: string;
  url?: string;
  tweetUrl?: string;
  full_text?: string;
  fullText?: string;
  text?: string;
  lang?: string;
  language?: string;
  created_at?: string;
  createdAt?: string;
  date?: string;
  user?: {
    username?: string;
    screen_name?: string;
    screenName?: string;
    name?: string;
    fullName?: string;
  };
  author?: {
    username?: string;
    screenName?: string;
    name?: string;
  };
  authorUsername?: string;
  authorScreenName?: string;
  authorName?: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
  };
  metrics?: {
    likeCount?: number;
    retweetCount?: number;
  };
  favoriteCount?: number;
  retweetCount?: number;
  matchedQueries?: string[];
  matchedKeywords?: string[];
  searchTerms?: string[];
}

export interface NormalizationContext {
  runId: string;
  rawTweetId: string | null;
  collectedAt: string;
  keywords: string[];
}

const coalesce = <T>(...values: Array<T | null | undefined>): T | null => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
};

const toIsoString = (value: string | null): string => {
  const fallback = new Date().toISOString();

  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString();
};

export const extractPlatformId = (item: ApifyTweetItem): string => {
  const candidate = coalesce(
    item.id,
    item.id_str,
    item.tweetId,
    item.tweet_id,
  );

  if (!candidate) {
    throw new Error('Tweet item is missing a platform identifier.');
  }

  return candidate;
};

const resolveContent = (item: ApifyTweetItem): string => {
  const candidate = coalesce(item.full_text, item.fullText, item.text);

  if (!candidate) {
    throw new Error('Tweet item is missing text content.');
  }

  return candidate;
};

const resolveAuthorHandle = (item: ApifyTweetItem): string | null => {
  return (
    coalesce(
      item.author?.username,
      item.author?.screenName,
      item.user?.username,
      item.user?.screen_name,
      item.user?.screenName,
      item.authorUsername,
      item.authorScreenName,
    ) ?? null
  );
};

const resolveAuthorName = (item: ApifyTweetItem): string | null => {
  return (
    coalesce(
      item.author?.name,
      item.user?.name,
      item.user?.fullName,
      item.authorName,
    ) ?? null
  );
};

const resolveUrl = (item: ApifyTweetItem, platformId: string, authorHandle: string | null): string | null => {
  const directUrl = coalesce(item.url, item.tweetUrl);
  if (directUrl) {
    return directUrl;
  }

  if (authorHandle) {
    return `https://twitter.com/${authorHandle}/status/${platformId}`;
  }

  return null;
};

const resolveLikes = (item: ApifyTweetItem): number | null => {
  return (
    coalesce(
      item.public_metrics?.like_count,
      item.metrics?.likeCount,
      item.favoriteCount,
    ) ?? null
  );
};

const resolveRetweets = (item: ApifyTweetItem): number | null => {
  return (
    coalesce(
      item.public_metrics?.retweet_count,
      item.metrics?.retweetCount,
      item.retweetCount,
    ) ?? null
  );
};

const resolveLanguage = (item: ApifyTweetItem): string | null => {
  return coalesce(item.lang, item.language);
};

const collectKeywords = (item: ApifyTweetItem, baseKeywords: string[]): string[] => {
  const keywordSet = new Set<string>();

  for (const keyword of baseKeywords) {
    keywordSet.add(keyword.toLowerCase());
  }

  for (const keyword of item.matchedKeywords ?? []) {
    keywordSet.add(keyword.toLowerCase());
  }

  for (const keyword of item.matchedQueries ?? []) {
    keywordSet.add(keyword.toLowerCase());
  }

  for (const keyword of item.searchTerms ?? []) {
    keywordSet.add(keyword.toLowerCase());
  }

  return Array.from(keywordSet);
};

export const normalizeTweet = (
  item: ApifyTweetItem,
  context: NormalizationContext,
): NormalizedTweetInsert => {
  const platformId = extractPlatformId(item);
  const content = resolveContent(item);
  const authorHandle = resolveAuthorHandle(item);
  const authorName = resolveAuthorName(item);
  const url = resolveUrl(item, platformId, authorHandle);
  const postedAt = toIsoString(
    coalesce(item.createdAt, item.created_at, item.date),
  );
  const language = resolveLanguage(item);
  const engagementLikes = resolveLikes(item);
  const engagementRetweets = resolveRetweets(item);
  const keywordSnapshot = collectKeywords(item, context.keywords);

  return {
    rawTweetId: context.rawTweetId,
    runId: context.runId,
    platform: 'twitter',
    platformId,
    revision: 1,
    authorHandle,
    authorName,
    postedAt,
    collectedAt: context.collectedAt,
    language,
    content,
    url,
    engagementLikes,
    engagementRetweets,
    keywordSnapshot,
    status: 'pending_sentiment',
    statusChangedAt: context.collectedAt,
    modelContext: {
      collector: 'apify-actor',
    },
  } satisfies NormalizedTweetInsert;
};

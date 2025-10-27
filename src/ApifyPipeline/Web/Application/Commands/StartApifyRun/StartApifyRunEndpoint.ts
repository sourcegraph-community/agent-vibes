import { NextResponse } from 'next/server';

import {
  startApifyRunCommandHandler,
  type StartApifyRunCommandInput,
} from './index';
import { startApifyActorRunRaw } from '@/src/ApifyPipeline/ExternalServices/Apify/client';
import { createSupabaseServiceClient } from '@/src/ApifyPipeline/ExternalServices/Supabase/client';
import { fetchEnabledKeywords } from '@/src/ApifyPipeline/DataAccess/Repositories/KeywordsRepository';

const isAuthorized = (request: Request): boolean => {
  // Allow Vercel Cron requests with CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Fallback: Allow requests with x-vercel-cron header (legacy support)
  if (request.headers.get('x-vercel-cron')) {
    return true;
  }

  // Allow public GET trigger when enabled and not in production
  const allowPublic = process.env.ALLOW_PUBLIC_START_APIFY === 'true';
  const vercelEnv = process.env.VERCEL_ENV;
  const isProd = vercelEnv === 'production';
  if (request.method === 'GET' && allowPublic && !isProd) {
    return true;
  }

  // Allow manual requests with valid API key via header
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (expectedKey && apiKey === expectedKey) {
    return true;
  }

  // Optionally allow API key via query param for address-bar triggers (non-prod only)
  const allowQueryKey = process.env.ALLOW_API_KEY_QUERY === 'true' && process.env.NODE_ENV !== 'production';
  if (allowQueryKey) {
    try {
      const url = new URL(request.url);
      const qKey = url.searchParams.get('apiKey') ?? url.searchParams.get('key');
      if (expectedKey && qKey === expectedKey) {
        return true;
      }
      const qBearer = url.searchParams.get('bearer');
      if (cronSecret && qBearer === cronSecret) {
        return true;
      }
    } catch {
      // ignore URL parse errors
    }
  }

  return false;
};

const resolveTriggerSource = (request: Request, provided?: string): string => {
  if (provided) {
    return provided;
  }

  if (request.headers.get('x-vercel-cron') || request.headers.get('authorization')?.startsWith('Bearer ')) {
    return 'vercel-cron';
  }

  return 'manual';
};

function looksLikeTweetScraperRaw(input: unknown): input is Record<string, unknown> {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;
  if (Array.isArray(obj.searchTerms)) return true;
  if ('includeSearchTerms' in obj) return true;
  if ('tweetLanguage' in obj) return true;
  if ('sort' in obj) return true;
  if ('maxItems' in obj) return true;
  return false;
}

async function readJsonBody(request: Request): Promise<unknown | undefined> {
  if (request.method !== 'POST') return undefined;
  try {
    return await request.json();
  } catch {
    try {
      const text = await request.text();
      if (!text) return undefined;
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }
}

function readJsonFromQuery(request: Request): unknown | undefined {
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get('input')
      ?? url.searchParams.get('raw')
      ?? url.searchParams.get('json');
    if (!raw) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function resolveKeywords(): Promise<string[]> {
  const override = process.env.COLLECTOR_KEYWORDS;
  if (override && override.trim().length > 0) {
    return override.split(',').map((s) => s.trim()).filter(Boolean);
  }
  try {
    const supabase = createSupabaseServiceClient();
    const kws = await fetchEnabledKeywords(supabase);
    if (kws.length > 0) return kws;
  } catch {
    // ignore, fall back to defaults
  }
  return [
    'ampcode.com',
    'ampcode',
    '"sourcegraph amp"',
    '(to:ampcode)',
    'windsurf',
    '(to:windsurf)',
    'windsurf.com',
    'augmentcode',
    'augmentcode.com',
    '(to:augmentcode)',
    'cline',
    'cline.bot',
    '(to:cline)',
    'kilocode',
    'kilocode.ai',
    '(to:kilocode)',
    'opencode',
    'opencode.ai',
    '(to:opencode)',
  ];
}

function pickNumber(val: unknown, def: number): number {
  const n = typeof val === 'number' ? val : Number.parseInt(String(val ?? ''));
  return Number.isFinite(n) && n > 0 ? n : def;
}

export const startApifyRunEndpoint = async (request: Request): Promise<Response> => {
  const cacheHeaders = request.method === 'GET' ? { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' } : undefined;

  if (request.method !== 'POST' && request.method !== 'GET') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405, headers: cacheHeaders });
  }

  // Authentication check
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: cacheHeaders },
    );
  }

  // Accept JSON from POST body (even without proper Content-Type) or from GET query
  const rawBody = (await readJsonBody(request)) ?? readJsonFromQuery(request);

  let payload: Partial<StartApifyRunCommandInput> = {};
  if (rawBody && typeof rawBody === 'object') {
    payload = rawBody as Partial<StartApifyRunCommandInput>;
  }

  const triggerSource = resolveTriggerSource(request, payload.triggerSource);

  try {
    // If caller provided tweet-scraper style input, pass it through RAW (no wrapping)
    if (rawBody && looksLikeTweetScraperRaw(rawBody)) {
      const result = await startApifyActorRunRaw(rawBody as Record<string, unknown>);
      return NextResponse.json({ data: result }, { status: 202, headers: cacheHeaders });
    }

    // If the configured actor is tweet-scraper, synthesize the same payload as the local script
    const actorId = process.env.APIFY_ACTOR_ID ?? '';
    const isTweetScraper = /tweet-scraper/i.test(actorId);
    if (isTweetScraper) {
      const keywords = await resolveKeywords();
      const ing = payload.ingestion ?? {};

      const maxItems = pickNumber((ing as { maxItems?: number }).maxItems, pickNumber(process.env.COLLECTOR_MAX_ITEMS, 100));
      const sort = (ing as { sort?: 'Top' | 'Latest' }).sort ?? ((process.env.COLLECTOR_SORT === 'Top' ? 'Top' : 'Latest') as 'Top' | 'Latest');
      const tweetLanguage = (ing as { tweetLanguage?: string }).tweetLanguage ?? (process.env.COLLECTOR_LANGUAGE || 'en');
      const minRetweets = (ing as { minimumEngagement?: { retweets?: number } }).minimumEngagement?.retweets;
      const minFavorites = (ing as { minimumEngagement?: { favorites?: number } }).minimumEngagement?.favorites;
      const minReplies = (ing as { minimumEngagement?: { replies?: number } }).minimumEngagement?.replies;

      const requestBody: Record<string, unknown> = {
        searchTerms: keywords,
        maxItems,
        tweetLanguage,
        sort,
        includeSearchTerms: true,
      };
      if (typeof minRetweets === 'number') requestBody.minimumRetweets = minRetweets;
      if (typeof minFavorites === 'number') requestBody.minimumFavorites = minFavorites;
      if (typeof minReplies === 'number') requestBody.minimumReplies = minReplies;

      const result = await startApifyActorRunRaw(requestBody);
      return NextResponse.json({ data: result }, { status: 202, headers: cacheHeaders });
    }

    const result = await startApifyRunCommandHandler({
      ...payload,
      triggerSource,
    });

    return NextResponse.json({ data: result }, { status: 202, headers: cacheHeaders });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to start Apify run',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers: cacheHeaders },
    );
  }
};

import { NextResponse } from 'next/server';

import {
  startApifyRunCommandHandler,
  type StartApifyRunCommandInput,
} from './index';

const isJsonRequest = (request: Request): boolean => {
  const contentType = request.headers.get('content-type');
  return contentType?.includes('application/json') ?? false;
};

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

  let payload: Partial<StartApifyRunCommandInput> = {};

  if (request.method === 'POST' && isJsonRequest(request)) {
    try {
      payload = (await request.json()) as Partial<StartApifyRunCommandInput>;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON payload', details: String(error) },
        { status: 400, headers: cacheHeaders },
      );
    }
  }

  const triggerSource = resolveTriggerSource(request, payload.triggerSource);

  try {
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

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

  // Allow manual requests with valid API key
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (expectedKey && apiKey === expectedKey) {
    return true;
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
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Authentication check
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let payload: Partial<StartApifyRunCommandInput> = {};

  if (isJsonRequest(request)) {
    try {
      payload = (await request.json()) as Partial<StartApifyRunCommandInput>;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON payload', details: String(error) },
        { status: 400 },
      );
    }
  }

  const triggerSource = resolveTriggerSource(request, payload.triggerSource);

  try {
    const result = await startApifyRunCommandHandler({
      ...payload,
      triggerSource,
    });

    return NextResponse.json({ data: result }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to start Apify run',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};

import { NextResponse } from 'next/server';
import { syncEntriesCommandHandler, type SyncEntriesCommandInput } from './index';

const isJsonRequest = (request: Request): boolean => {
  const contentType = request.headers.get('content-type');
  return contentType?.includes('application/json') ?? false;
};

const isAuthorized = (request: Request): boolean => {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  if (request.headers.get('x-vercel-cron')) {
    return true;
  }

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

export const syncEntriesEndpoint = async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Partial<SyncEntriesCommandInput> = {};

  if (isJsonRequest(request)) {
    try {
      payload = (await request.json()) as Partial<SyncEntriesCommandInput>;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON payload', details: String(error) },
        { status: 400 },
      );
    }
  }

  const triggerSource = resolveTriggerSource(request, payload.triggerSource);

  try {
    const result = await syncEntriesCommandHandler({
      ...payload,
      triggerSource,
    });

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to sync RSS entries',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};

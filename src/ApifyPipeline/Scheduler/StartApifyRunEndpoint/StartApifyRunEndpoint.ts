import { NextResponse } from 'next/server';

import {
  startApifyRunExecutor,
  type StartApifyRunCommandInput,
} from '@/src/ApifyPipeline/Scheduler/StartApifyRunExecutor';

const isJsonRequest = (request: Request): boolean => {
  const contentType = request.headers.get('content-type');
  return contentType?.includes('application/json') ?? false;
};

const resolveTriggerSource = (request: Request, provided?: string): string => {
  if (provided) {
    return provided;
  }

  if (request.headers.get('x-vercel-cron')) {
    return 'vercel-cron';
  }

  return 'manual';
};

export const startApifyRunEndpoint = async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
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
    const result = await startApifyRunExecutor({
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

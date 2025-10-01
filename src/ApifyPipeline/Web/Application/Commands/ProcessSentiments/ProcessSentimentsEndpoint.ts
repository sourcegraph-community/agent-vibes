import { NextResponse } from 'next/server';
import type { ProcessSentimentsCommand } from './ProcessSentimentsCommand';
import { handleProcessSentiments } from './ProcessSentimentsCommandHandler';

const isAuthorized = (request: Request): boolean => {
  // Allow Vercel Cron requests
  const cronHeader = request.headers.get('x-vercel-cron');
  if (cronHeader) {
    return true;
  }

  // Allow requests with valid API key
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (expectedKey && apiKey === expectedKey) {
    return true;
  }

  return false;
};

export const POST = async (request: Request): Promise<NextResponse> => {
  // Authentication check
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));

    const command: ProcessSentimentsCommand = {
      batchSize: body.batchSize ?? 10,
      modelVersion: body.modelVersion,
      maxRetries: body.maxRetries,
    };

    const response = await handleProcessSentiments(command);

    return NextResponse.json(response, {
      status: response.success ? 200 : 500,
    });
  }
  catch (error) {
    const isProd = process.env.VERCEL_ENV === 'production';
    return NextResponse.json(
      {
        success: false,
        message: isProd ? 'Internal server error' : (error instanceof Error ? error.message : 'Internal server error'),
      },
      { status: 500 },
    );
  }
};

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/src/ApifyPipeline/Infrastructure/Config/supabase';
import { BackfillProcessorJob } from '@/src/ApifyPipeline/Background/Jobs/BackfillProcessor/BackfillProcessorJob';
import { authenticateRequest } from '@/src/ApifyPipeline/Infrastructure/Utilities/auth';
import { processBackfillCommandHandler } from './ProcessBackfillCommandHandler';
import type { ProcessBackfillCommand } from './ProcessBackfillCommand';

export async function POST(request: NextRequest) {
  const authError = authenticateRequest(request);
  if (authError) {
    return NextResponse.json(
      { error: authError },
      { status: 401 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const command: ProcessBackfillCommand = {};

    const result = await processBackfillCommandHandler(command, {
      createJob: () => new BackfillProcessorJob(supabase),
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  }
  catch (error) {
    console.error('Backfill processing error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process backfill batch',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

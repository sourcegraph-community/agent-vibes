import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../Infrastructure/Config/supabase';
import { BackfillProcessorJob } from '../../../../Background/Jobs/BackfillProcessor/BackfillProcessorJob';
import { authenticateRequest } from '../../../../Infrastructure/Utilities/auth';

export async function POST(request: NextRequest) {
  try {
    const authError = authenticateRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: authError },
        { status: 401 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const job = new BackfillProcessorJob(supabase);

    const nextBatch = await job.getNextBatch();

    if (!nextBatch) {
      return NextResponse.json({
        success: true,
        message: 'No pending backfill batches',
      });
    }

    await job.processBatch(nextBatch.id);

    return NextResponse.json({
      success: true,
      message: `Processed backfill batch ${nextBatch.id}`,
      batchId: nextBatch.id,
    });
  }
  catch (err) {
    const error = err as Error;
    console.error('Backfill processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process backfill batch', details: error.message },
      { status: 500 },
    );
  }
}

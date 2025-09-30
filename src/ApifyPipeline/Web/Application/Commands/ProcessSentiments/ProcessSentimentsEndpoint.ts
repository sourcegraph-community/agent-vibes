import { NextResponse } from 'next/server';
import type { ProcessSentimentsCommand } from './ProcessSentimentsCommand';
import { handleProcessSentiments } from './ProcessSentimentsCommandHandler';

export const POST = async (request: Request): Promise<NextResponse> => {
  try {
    const body = await request.json().catch(() => ({}));

    const command: ProcessSentimentsCommand = {
      batchSize: body.batchSize ?? 10,
      modelVersion: body.modelVersion,
    };

    const response = await handleProcessSentiments(command);

    return NextResponse.json(response, {
      status: response.success ? 200 : 500,
    });
  }
  catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
};

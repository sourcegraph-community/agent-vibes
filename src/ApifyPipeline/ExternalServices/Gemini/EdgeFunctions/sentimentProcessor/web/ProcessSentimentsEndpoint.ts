import { parseProcessSentimentsCommand } from '../application/ProcessSentimentsCommand.ts';
import { handleProcessSentiments } from '../application/ProcessSentimentsHandler.ts';
import { loadEnvironment } from '../infrastructure/env.ts';
import { createSupabaseClient } from '../infrastructure/supabaseClient.ts';
import { SupabaseTweetRepository } from '../infrastructure/supabaseTweetRepository.ts';
import { GeminiSentimentAnalyzer } from '../core/GeminiSentimentAnalyzer.ts';
import type { ProcessSentimentsCommandInput } from '../types.ts';

const isAuthorized = (request: Request, serviceRoleKey: string): boolean => {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${serviceRoleKey}`) {
    return true;
  }
  return false;
};

export const sentimentProcessorEndpoint = async (request: Request): Promise<Response> => {
  try {
    const env = loadEnvironment();

    if (!isAuthorized(request, env.supabaseServiceRoleKey)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    const payload = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

    const commandInput = parseProcessSentimentsCommand(payload);
    const resolvedModelVersion = commandInput.modelVersion ?? env.geminiModel;

    const supabase = createSupabaseClient(env.supabaseUrl, env.supabaseServiceRoleKey);
    const repository = new SupabaseTweetRepository(supabase);
    const analyzer = new GeminiSentimentAnalyzer({
      apiKey: env.geminiApiKey,
      model: resolvedModelVersion,
    });

    const normalizedCommand: ProcessSentimentsCommandInput = {
      batchSize: commandInput.batchSize,
      modelVersion: resolvedModelVersion,
      maxRetries: commandInput.maxRetries,
    };

    const result = await handleProcessSentiments(normalizedCommand, {
      repository,
      analyzer,
      defaults: {
        batchSize: 100,
        modelVersion: resolvedModelVersion,
        maxRetries: 3,
        rateLimitDelayMs: env.rateLimitDelayMs,
        concurrency: env.concurrency,
        rpmCap: env.rpmCap,
        tpmCap: env.tpmCap,
        tokensPerRequestEstimate: env.tokensPerRequestEstimate,
      },
    });

    return new Response(
      JSON.stringify({
        success: result.success,
        message: result.message,
        stats: result.stats,
      }),
      {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
  catch (error) {
    console.error('Sentiment processor failed', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};

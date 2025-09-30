import { z } from 'zod';

import {
  startApifyActorRun,
  type StartApifyRunInput,
  type StartApifyRunResult,
} from '@/src/ApifyPipeline/Scheduler/Domain/Integrations/Apify/client';

const ingestionSchema = z
  .object({
    tweetLanguage: z
      .string()
      .trim()
      .min(2, 'tweetLanguage must be at least 2 characters long')
      .max(5)
      .optional(),
    sort: z.enum(['Top', 'Latest']).default('Top'),
    maxItemsPerKeyword: z.number().int().min(1).max(1000).default(200),
    keywordBatchSize: z.number().int().min(1).max(5).default(5),
    cooldownSeconds: z.number().int().min(0).max(3600).default(0),
    minimumEngagement: z
      .object({
        retweets: z.number().int().min(0).optional(),
        favorites: z.number().int().min(0).optional(),
        replies: z.number().int().min(0).optional(),
      })
      .partial()
      .optional()
      .default({}),
  })
  .default({
    sort: 'Top',
    maxItemsPerKeyword: 200,
    keywordBatchSize: 5,
    cooldownSeconds: 0,
    minimumEngagement: {},
  });

const commandSchema = z.object({
  triggerSource: z.string().default('manual'),
  requestedBy: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
  ingestion: ingestionSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type StartApifyRunExecutor = z.infer<typeof commandSchema>;
export type StartApifyRunExecutorInput = z.input<typeof commandSchema>;
export type StartApifyRunExecutorResult = StartApifyRunResult;

export const startApifyRunExecutor = async (
  input: StartApifyRunExecutorInput,
): Promise<StartApifyRunExecutorResult> => {
  const parsed = commandSchema.parse(input);

  const payload: StartApifyRunInput = {
    triggerSource: parsed.triggerSource,
    requestedBy: parsed.requestedBy,
    ingestion: parsed.ingestion,
    metadata: parsed.metadata,
  };

  const result = await startApifyActorRun(payload, { dryRun: parsed.dryRun });

  return result satisfies StartApifyRunExecutorResult;
};

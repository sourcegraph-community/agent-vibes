import { z } from 'npm:zod';
import type { ProcessSentimentsCommandInput } from '../types.ts';

const commandSchema = z
  .object({
    batchSize: z.number().int().min(1).max(25).optional(),
    modelVersion: z.string().min(1).optional(),
    maxRetries: z.number().int().min(0).max(5).optional(),
  })
  .default({});

export const parseProcessSentimentsCommand = (payload: unknown): ProcessSentimentsCommandInput => {
  return commandSchema.parse(payload);
};

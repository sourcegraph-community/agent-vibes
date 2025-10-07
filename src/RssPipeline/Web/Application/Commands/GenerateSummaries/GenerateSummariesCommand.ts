import { z } from 'zod';

export const commandSchema = z.object({
  triggerSource: z.string().default('manual'),
  requestedBy: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
  options: z.object({
    batchSize: z.number().int().min(1).max(100).default(20),
    maxRetries: z.number().int().min(1).max(5).default(3),
    resetStuckEntries: z.boolean().default(true),
  }).default({
    batchSize: 20,
    maxRetries: 3,
    resetStuckEntries: true,
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type GenerateSummariesCommand = z.infer<typeof commandSchema>;
export type GenerateSummariesCommandInput = z.input<typeof commandSchema>;

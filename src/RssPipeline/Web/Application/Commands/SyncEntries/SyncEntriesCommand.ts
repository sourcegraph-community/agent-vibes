import { z } from 'zod';

export const commandSchema = z.object({
  triggerSource: z.string().default('manual'),
  requestedBy: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
  options: z.object({
    limit: z.number().int().min(1).max(500).default(100),
    status: z.enum(['unread', 'read', 'removed']).optional(),
    starred: z.boolean().optional(),
    publishedAfter: z.string().optional(),
  }).default({
    limit: 100,
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SyncEntriesCommand = z.infer<typeof commandSchema>;
export type SyncEntriesCommandInput = z.input<typeof commandSchema>;

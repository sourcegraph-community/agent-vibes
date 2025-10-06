import { z } from 'zod';

const ingestionSchema = z
  .object({
    tweetLanguage: z
      .string()
      .trim()
      .min(2, 'tweetLanguage must be at least 2 characters long')
      .max(5)
      .optional(),
    sort: z.enum(['Top', 'Latest']).default('Latest'),
    // Max total items to fetch in a single Apify run
    maxItems: z.number().int().min(1).max(1000).default(100),

    cooldownSeconds: z.number().int().min(0).max(3600).default(0),
    // Disabled by default to align with one-shot collection behavior
    useDateFiltering: z.boolean().default(false),
    defaultLookbackDays: z.number().int().min(1).max(30).default(7),
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
    sort: 'Latest',
    maxItems: 100,
    cooldownSeconds: 0,
    useDateFiltering: false,
    defaultLookbackDays: 7,
    minimumEngagement: {},
  });

export const commandSchema = z.object({
  triggerSource: z.string().default('manual'),
  requestedBy: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
  ingestion: ingestionSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type StartApifyRunCommand = z.infer<typeof commandSchema>;
export type StartApifyRunCommandInput = z.input<typeof commandSchema>;

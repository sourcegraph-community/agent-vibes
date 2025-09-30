import { z } from 'zod';

type EnvironmentShape = z.infer<typeof baseEnvSchema>;

type OptionalEnvironmentShape = z.infer<typeof optionalEnvSchema>;

const baseEnvSchema = z.object({
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be a valid URL.' }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required.'),
});

const optionalEnvSchema = z.object({
  APIFY_TOKEN: z.string().min(1).optional(),
  APIFY_ACTOR_ID: z.string().min(1).optional(),
  APIFY_ACTOR_BUILD: z.string().min(1).optional(),
});

export interface SupabaseEnvConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

export interface ApifyEnvConfig {
  token: string;
  actorId: string;
  actorBuild?: string;
}

export const getSupabaseEnv = (env: NodeJS.ProcessEnv = process.env): SupabaseEnvConfig => {
  const parsed = baseEnvSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join('\n'));
  }

  return {
    supabaseUrl: parsed.data.SUPABASE_URL,
    supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  } satisfies SupabaseEnvConfig;
};

export const getApifyEnv = (env: NodeJS.ProcessEnv = process.env): ApifyEnvConfig => {
  const parsed = optionalEnvSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join('\n'));
  }

  const { APIFY_TOKEN, APIFY_ACTOR_ID, APIFY_ACTOR_BUILD } = parsed.data;

  if (!APIFY_TOKEN || !APIFY_ACTOR_ID) {
    throw new Error('APIFY_TOKEN and APIFY_ACTOR_ID must be configured.');
  }

  return {
    token: APIFY_TOKEN,
    actorId: APIFY_ACTOR_ID,
    actorBuild: APIFY_ACTOR_BUILD,
  } satisfies ApifyEnvConfig;
};

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
  GEMINI_API_KEY: z.string().min(1).optional(),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_FUNCTIONS_URL: z.string().url().optional(),
});

export interface SupabaseEnvConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseFunctionsUrl: string;
}

export interface SupabaseClientEnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface ApifyEnvConfig {
  token: string;
  actorId: string;
  actorBuild?: string;
}

export interface GeminiEnvConfig {
  apiKey: string;
}

export const getSupabaseEnv = (env: NodeJS.ProcessEnv = process.env): SupabaseEnvConfig => {
  const base = baseEnvSchema.safeParse(env);
  const optional = optionalEnvSchema.safeParse(env);

  if (!base.success) {
    throw new Error(base.error.flatten().formErrors.join('\n'));
  }

  const supabaseUrl = base.data.SUPABASE_URL;
  const supabaseFunctionsUrl = optional.success && optional.data.SUPABASE_FUNCTIONS_URL
    ? optional.data.SUPABASE_FUNCTIONS_URL.replace(/\/$/, '')
    : new URL('functions/v1/', supabaseUrl).toString().replace(/\/$/, '');

  return {
    supabaseUrl,
    supabaseServiceRoleKey: base.data.SUPABASE_SERVICE_ROLE_KEY,
    supabaseFunctionsUrl,
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

export const getGeminiEnv = (env: NodeJS.ProcessEnv = process.env): GeminiEnvConfig => {
  const parsed = optionalEnvSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join('\n'));
  }

  const { GEMINI_API_KEY } = parsed.data;

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY must be configured for sentiment analysis.');
  }

  return {
    apiKey: GEMINI_API_KEY,
  } satisfies GeminiEnvConfig;
};

export const getSupabaseClientEnv = (env: NodeJS.ProcessEnv = process.env): SupabaseClientEnvConfig => {
  const parsed = optionalEnvSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join('\n'));
  }

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = parsed.data;

  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured for client-side access.');
  }

  return {
    supabaseUrl: NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: NEXT_PUBLIC_SUPABASE_ANON_KEY,
  } satisfies SupabaseClientEnvConfig;
};

export const getVercelEnv = (env: NodeJS.ProcessEnv = process.env): string | undefined => {
  const parsed = optionalEnvSchema.safeParse(env);

  if (!parsed.success) {
    return undefined;
  }

  return parsed.data.VERCEL_ENV;
};

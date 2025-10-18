import { z } from 'npm:zod';
import type { EnvironmentConfig } from '../types.ts';

const envSchema = z.object({
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be set for Edge Function.' }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, { message: 'SUPABASE_SERVICE_ROLE_KEY must be set for Edge Function.' }),
  GEMINI_API_KEY: z.string().min(1, { message: 'GEMINI_API_KEY is required for sentiment processing.' }),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash-lite'),
  // Optional concurrency & rate-limit knobs (strings in env, parse to numbers below)
  SENTIMENT_CONCURRENCY: z.string().optional(),
  SENTIMENT_RPM_CAP: z.string().optional(),
  SENTIMENT_TPM_CAP: z.string().optional(),
  SENTIMENT_TOKENS_PER_REQUEST_ESTIMATE: z.string().optional(),
  SENTIMENT_RATE_LIMIT_DELAY_MS: z.string().optional(),
});

export const loadEnvironment = (): EnvironmentConfig => {
  const parsed = envSchema.parse({
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    GEMINI_API_KEY: Deno.env.get('GEMINI_API_KEY'),
    GEMINI_MODEL: Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite',
    SENTIMENT_CONCURRENCY: Deno.env.get('SENTIMENT_CONCURRENCY') ?? undefined,
    SENTIMENT_RPM_CAP: Deno.env.get('SENTIMENT_RPM_CAP') ?? undefined,
    SENTIMENT_TPM_CAP: Deno.env.get('SENTIMENT_TPM_CAP') ?? undefined,
    SENTIMENT_TOKENS_PER_REQUEST_ESTIMATE: Deno.env.get('SENTIMENT_TOKENS_PER_REQUEST_ESTIMATE') ?? undefined,
    SENTIMENT_RATE_LIMIT_DELAY_MS: Deno.env.get('SENTIMENT_RATE_LIMIT_DELAY_MS') ?? undefined,
  });

  const toInt = (v: string | undefined, def: number) => {
    const n = v ? Number.parseInt(v, 10) : NaN;
    return Number.isFinite(n) ? n : def;
  };

  const concurrency = Math.max(1, Math.min(1000, toInt(parsed.SENTIMENT_CONCURRENCY, 5)));
  const rpmCap = toInt(parsed.SENTIMENT_RPM_CAP, 1000) || undefined;
  const tpmCap = toInt(parsed.SENTIMENT_TPM_CAP, 0) || undefined;
  const tokensPerRequestEstimate = Math.max(1, toInt(parsed.SENTIMENT_TOKENS_PER_REQUEST_ESTIMATE, 600));
  const rateLimitDelayMs = Math.max(0, toInt(parsed.SENTIMENT_RATE_LIMIT_DELAY_MS, 0));

  return {
    supabaseUrl: parsed.SUPABASE_URL,
    supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    geminiApiKey: parsed.GEMINI_API_KEY,
    geminiModel: parsed.GEMINI_MODEL,
    concurrency,
    rpmCap,
    tpmCap,
    tokensPerRequestEstimate,
    rateLimitDelayMs,
  } satisfies EnvironmentConfig;
};

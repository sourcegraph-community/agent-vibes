import { z } from 'npm:zod';
import type { EnvironmentConfig } from '../types.ts';

const envSchema = z.object({
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be set for Edge Function.' }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, { message: 'SUPABASE_SERVICE_ROLE_KEY must be set for Edge Function.' }),
  GEMINI_API_KEY: z.string().min(1, { message: 'GEMINI_API_KEY is required for sentiment processing.' }),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),
});

export const loadEnvironment = (): EnvironmentConfig => {
  const parsed = envSchema.parse({
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    GEMINI_API_KEY: Deno.env.get('GEMINI_API_KEY'),
    GEMINI_MODEL: Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash',
  });

  return {
    supabaseUrl: parsed.SUPABASE_URL,
    supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    geminiApiKey: parsed.GEMINI_API_KEY,
    geminiModel: parsed.GEMINI_MODEL,
  } satisfies EnvironmentConfig;
};

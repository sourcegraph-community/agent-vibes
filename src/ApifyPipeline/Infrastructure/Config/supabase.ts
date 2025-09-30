import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseEnv } from './env';

export async function createSupabaseServerClient() {
  const env = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          }
          catch {
            // Ignored: can happen in Server Components
          }
        },
      },
    },
  );
}

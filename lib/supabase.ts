import { createClient } from '@supabase/supabase-js';

// Supabase client for server-side usage
export const createSupabaseServerClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Supabase client for client-side usage
export const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing public Supabase environment variables - real-time features disabled');
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

// Real-time subscription helper
export const subscribeToEntries = (callback: (payload: any) => void) => {
  const supabase = createSupabaseClient();

  if (!supabase) {
    console.warn('Supabase not configured - skipping subscription');
    return { unsubscribe: () => {} };
  }

  return supabase
    .channel('entries')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'Entry',
      },
      callback,
    )
    .subscribe();
};

// Analytics helpers
export const trackUserEvent = async (event: string, properties: Record<string, any> = {}) => {
  if (typeof window === 'undefined') return; // Server-side skip

  try {
    const supabase = createSupabaseClient();

    if (!supabase) {
      console.warn('Supabase not configured - skipping analytics');
      return;
    }

    await supabase
      .from('analytics_events')
      .insert({
        event,
        properties,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        url: window.location.href,
      });
  } catch (error) {
    console.error('Failed to track event:', error);
  }
};

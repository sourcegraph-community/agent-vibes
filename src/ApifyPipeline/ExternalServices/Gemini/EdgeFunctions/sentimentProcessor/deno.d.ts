declare module 'https://deno.land/std@0.224.0/http/server.ts' {
  export function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare module 'npm:@supabase/supabase-js' {
  export * from '@supabase/supabase-js';
}

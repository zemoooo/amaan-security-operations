import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let configPromise: Promise<{ url: string, key: string }> | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (supabaseInstance) return supabaseInstance;

  // If already fetching, wait for it
  if (configPromise) {
    const config = await configPromise;
    if (config.url && config.key) {
      supabaseInstance = createClient(config.url, config.key);
      return supabaseInstance;
    }
    return null;
  }

  // Fetch config from server
  configPromise = fetch('/api/supabase-config')
    .then(res => res.json())
    .catch(() => ({ url: '', key: '' }));
  
  const config = await configPromise;

  // Fallback to import.meta.env if API fails but env is set in Vite
  const url = config.url || (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const key = config.key || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  if (url && key) {
    supabaseInstance = createClient(url, key);
    return supabaseInstance;
  }

  return null;
}

import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  return (window as any).__ENV__?.[key] || (import.meta as any).env[key] || '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Using actual values if configured, fallback to dummy values during initial setup to avoid application crashes on load.
const dummyUrl = 'https://placeholder-project-id.supabase.co';
const dummyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MTY0MTY0MTYsImV4cCI6MTkxNjQxNjQxNn0.dummy';

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : dummyUrl,
  isSupabaseConfigured ? supabaseAnonKey : dummyKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

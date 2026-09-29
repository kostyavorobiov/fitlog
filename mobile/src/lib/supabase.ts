import { createClient } from '@supabase/supabase-js';
import { MobileStorage } from './storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-project-id')
  );
};

const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';



// Storage adapter compatible with Supabase auth for React Native, Web & Node
const storageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await MobileStorage.getItem<string | null>(key, null);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await MobileStorage.setItem(key, value);
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await MobileStorage.removeItem(key);
    } catch {}
  },
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: storageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: isWeb,
      },
    })
  : null;



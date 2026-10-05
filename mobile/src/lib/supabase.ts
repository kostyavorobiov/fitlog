import { createClient } from '@supabase/supabase-js';
import { MobileStorage } from './storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';

let AsyncStorageModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-async-storage/async-storage');
  AsyncStorageModule = mod?.default || mod;
} catch {
  AsyncStorageModule = null;
}

const memoryStore = new Map<string, string>();

export const authStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (AsyncStorageModule && typeof AsyncStorageModule.getItem === 'function') {
        const val = await AsyncStorageModule.getItem(key);
        if (val !== null && val !== undefined) return val;
      }
      return memoryStore.get(key) || null;
    } catch {
      return memoryStore.get(key) || null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    memoryStore.set(key, value);
    try {
      if (AsyncStorageModule && typeof AsyncStorageModule.setItem === 'function') {
        await AsyncStorageModule.setItem(key, value);
      }
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    memoryStore.delete(key);
    try {
      if (AsyncStorageModule && typeof AsyncStorageModule.removeItem === 'function') {
        await AsyncStorageModule.removeItem(key);
      }
    } catch {}
  },
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: authStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: isWeb,
        flowType: 'pkce',
      },
    })
  : null;

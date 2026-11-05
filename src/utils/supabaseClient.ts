import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export const DEFAULT_SUPABASE_URL = 'https://vxkgxlomnvizqwzachie.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_NK0EaOo2owEELvqH0a-NeQ_oI4LvPXG';

export const getSupabaseConfig = async (): Promise<{ url: string; anonKey: string }> => {
  // 1. Check Expo public env vars
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const envKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

  // 2. Check saved store settings in AsyncStorage
  let savedUrl = '';
  let savedKey = '';
  try {
    const raw = await AsyncStorage.getItem('fireworks_pos_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      savedUrl = parsed.supabaseUrl || '';
      savedKey = parsed.supabaseAnonKey || '';
    }
  } catch {
    // ignore
  }

  return {
    url: (savedUrl || envUrl || DEFAULT_SUPABASE_URL).trim(),
    anonKey: (savedKey || envKey || DEFAULT_SUPABASE_KEY).trim(),
  };
};

export const getSupabaseClient = async (overrideUrl?: string, overrideKey?: string): Promise<SupabaseClient | null> => {
  const config = await getSupabaseConfig();
  const url = (overrideUrl !== undefined ? overrideUrl : config.url).trim();
  const anonKey = (overrideKey !== undefined ? overrideKey : config.anonKey).trim();

  if (!url || !anonKey) {
    return null;
  }

  if (cachedClient && lastUsedUrl === url && lastUsedKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    lastUsedUrl = url;
    lastUsedKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Expo Supabase client:', err);
    return null;
  }
};

export const testSupabaseConnection = async (
  testUrl?: string,
  testKey?: string
): Promise<{ success: boolean; message: string }> => {
  const client = await getSupabaseClient(testUrl, testKey);
  if (!client) {
    return { success: false, message: 'Supabase URL or Anon Key is missing.' };
  }

  try {
    const { error } = await client.from('products').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
        return {
          success: false,
          message: 'Connected to Supabase! However, database tables have not been created yet. Please run supabase_schema.sql in your Supabase SQL Editor.',
        };
      }
      return { success: false, message: `Database error: ${error.message}` };
    }
    return { success: true, message: 'Successfully connected to Supabase database!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to reach Supabase server.' };
  }
};


//JobHub/app/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as any;

export const supabase = createClient(
  extra.EXPO_PUBLIC_SUPABASE_URL,
  extra.EXPO_PUBLIC_SUPABASE_ANON_KEY
);
import { createClient } from "@supabase/supabase-js";

// These come from Supabase project settings
const SUPABASE_URL = "https://mlikucsqpohjspbuobxf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kii8gvtA9cnIUWJTliG8aA_fH3RuIF6";

// ⚠️ This is SAFE to be public (Supabase design)
// Auth + RLS protect data access
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

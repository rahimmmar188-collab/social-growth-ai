import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser-side singleton
let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _client;
}

export const supabase = typeof window !== "undefined" ? getSupabaseClient() : createClient(supabaseUrl, supabaseAnonKey);

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Competitor {
  id: string;
  user_id: string;
  name: string;
  platform: "instagram" | "linkedin" | "facebook" | "youtube";
  profile_url: string;
  about: string | null;
  created_at: string;
}

export interface CompetitorPost {
  id: string;
  competitor_id: string;
  post_url: string | null;
  title: string;
  description: string;
  thumbnail: string | null;
  engagement_score: number;
  created_at: string;
}

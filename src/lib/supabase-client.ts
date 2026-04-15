import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 브라우저에서 직접 사용하는 클라이언트 (anon key)
export const sb = createClient(supabaseUrl, supabaseAnonKey);

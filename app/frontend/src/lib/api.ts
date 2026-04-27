// Legacy compatibility shim.
// The app is now powered by Supabase. Prefer importing `supabase` directly
// from "@/lib/supabase" in new code.
export { supabase as client } from '@/lib/supabase';
export { supabase } from '@/lib/supabase';
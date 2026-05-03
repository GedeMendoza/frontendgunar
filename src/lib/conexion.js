import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ytkfmkdxggpcnvsfmpsr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MN6bd8bzfRGNyRqQeW1sxA_cWF1jTmp";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
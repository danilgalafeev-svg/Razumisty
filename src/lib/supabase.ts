import { createClient } from "@supabase/supabase-js";
import { getRequiredEnv } from "./env";

export const supabase = createClient(
  getRequiredEnv("VITE_SUPABASE_URL"),
  getRequiredEnv("VITE_SUPABASE_ANON_KEY"),
);


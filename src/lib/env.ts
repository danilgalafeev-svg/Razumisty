export function getRequiredEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY") {
  const value = import.meta.env[name] as string | undefined;
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}


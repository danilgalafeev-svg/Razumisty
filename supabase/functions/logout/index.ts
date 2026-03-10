import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { tokenHash } from "../_shared/crypto.ts";
import { handleOptions, jsonError, jsonOk } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    const body = (await req.json()) as { token?: string };
    const token = body.token ?? "";
    if (!token) return jsonOk({ ok: true });

    const supabase = createServiceClient();
    await supabase.from("sessions").delete().eq("token_hash", await tokenHash(token));
    return jsonOk({ ok: true });
  } catch {
    return jsonOk({ ok: true });
  }
});


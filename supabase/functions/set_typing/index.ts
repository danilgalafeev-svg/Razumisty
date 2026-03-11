import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { tokenHash } from "../_shared/crypto.ts";
import { handleOptions, jsonError, jsonOk } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    const body = (await req.json()) as { token?: string; isTyping?: boolean };
    const token = body.token ?? "";
    const isTyping = Boolean(body.isTyping);

    if (!token) return jsonError("Нет сессии", 401);

    const supabase = createServiceClient();
    const { data: session, error: se } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("token_hash", await tokenHash(token))
      .maybeSingle();
    if (se) return jsonError(se.message, 400);
    if (!session) return jsonError("Сессия истекла", 401);

    const { data: status, error: ue0 } = await supabase
      .from("users")
      .select("is_blocked")
      .eq("id", session.user_id)
      .maybeSingle();
    if (ue0) return jsonError(ue0.message, 400);
    if (!status || status.is_blocked) return jsonError("Пользователь заблокирован", 403);

    if (isTyping) {
      const { error: ie } = await supabase
        .from("typing_state")
        .upsert({ user_id: session.user_id, updated_at: new Date().toISOString() });
      if (ie) return jsonError(ie.message, 400);
    } else {
      const { error: de } = await supabase.from("typing_state").delete().eq("user_id", session.user_id);
      if (de) return jsonError(de.message, 400);
    }

    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError((e as Error).message || "Bad request", 400);
  }
});


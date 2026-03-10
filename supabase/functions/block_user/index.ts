import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { tokenHash } from "../_shared/crypto.ts";
import { handleOptions, jsonError, jsonOk } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    const body = (await req.json()) as { token?: string; userId?: string };
    const token = body.token ?? "";
    const userId = body.userId ?? "";
    if (!token) return jsonError("Нет сессии", 401);
    if (!userId) return jsonError("Не указан userId", 400);

    const supabase = createServiceClient();
    const { data: session, error: se } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("token_hash", await tokenHash(token))
      .maybeSingle();
    if (se) return jsonError(se.message, 400);
    if (!session) return jsonError("Сессия истекла", 401);
    if (session.user_id === userId) return jsonError("Нельзя блокировать себя", 400);

    const { data: user, error: ue } = await supabase
      .from("users")
      .select("is_moderator,is_blocked")
      .eq("id", session.user_id)
      .maybeSingle();
    if (ue) return jsonError(ue.message, 400);
    if (!user || user.is_blocked) return jsonError("Пользователь заблокирован", 403);
    if (!user.is_moderator) return jsonError("Нет прав", 403);

    const { error: be } = await supabase
      .from("users")
      .update({ is_blocked: true })
      .eq("id", userId);
    if (be) return jsonError(be.message, 400);

    await supabase.from("sessions").delete().eq("user_id", userId);
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError((e as Error).message || "Bad request", 400);
  }
});


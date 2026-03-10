import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { tokenHash } from "../_shared/crypto.ts";
import { handleOptions, jsonError, jsonOk } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    const body = (await req.json()) as { token?: string; text?: string; replyTo?: string | null };
    const token = body.token ?? "";
    const text = (body.text ?? "").trim();
    const replyTo = body.replyTo ?? null;

    if (!token) return jsonError("Нет сессии", 401);
    if (!text) return jsonError("Пустое сообщение", 400);
    if (text.length > 2000) return jsonError("Слишком длинное сообщение", 400);

    const supabase = createServiceClient();
    const { data: session, error: se } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("token_hash", await tokenHash(token))
      .maybeSingle();
    if (se) return jsonError(se.message, 400);
    if (!session) return jsonError("Сессия истекла", 401);

    if (replyTo) {
      const { data: exists, error: re } = await supabase
        .from("messages")
        .select("id")
        .eq("id", replyTo)
        .maybeSingle();
      if (re) return jsonError(re.message, 400);
      if (!exists) return jsonError("Исходное сообщение не найдено", 400);
    }

    const { data: message, error: me } = await supabase
      .from("messages")
      .insert({ user_id: session.user_id, text, reply_to: replyTo })
      .select("id,user_id,text,reply_to,created_at")
      .single();
    if (me) return jsonError(me.message, 400);

    return jsonOk({ message });
  } catch (e) {
    return jsonError((e as Error).message || "Bad request", 400);
  }
});


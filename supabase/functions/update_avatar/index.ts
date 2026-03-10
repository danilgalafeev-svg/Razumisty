import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ALLOWED_AVATARS } from "../_shared/avatars.ts";
import { tokenHash } from "../_shared/crypto.ts";
import { handleOptions, jsonError, jsonOk } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    const body = (await req.json()) as { token?: string; avatarEmoji?: string };
    const token = body.token ?? "";
    const avatarEmoji = body.avatarEmoji ?? "";

    if (!token) return jsonError("Нет сессии", 401);
    if (!ALLOWED_AVATARS.has(avatarEmoji)) return jsonError("Недопустимый emoji", 400);

    const supabase = createServiceClient();
    const { data: session, error: se } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("token_hash", await tokenHash(token))
      .maybeSingle();
    if (se) return jsonError(se.message, 400);
    if (!session) return jsonError("Сессия истекла", 401);

    const { data: user, error: ue } = await supabase
      .from("users")
      .update({ avatar_emoji: avatarEmoji })
      .eq("id", session.user_id)
      .select("id,nickname,avatar_emoji")
      .single();
    if (ue) return jsonError(ue.message, 400);

    return jsonOk({ user });
  } catch (e) {
    return jsonError((e as Error).message || "Bad request", 400);
  }
});


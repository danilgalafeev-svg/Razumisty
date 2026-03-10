import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createSessionToken, verifyPassword } from "../_shared/crypto.ts";
import { handleOptions, jsonError, jsonOk } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    const body = (await req.json()) as { nickname?: string; password?: string };
    const nickname = (body.nickname ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!nickname || !password) return jsonError("Неверный никнейм или пароль", 401);

    const supabase = createServiceClient();
    const { data: user, error } = await supabase
      .from("users")
      .select("id,nickname,password_hash,avatar_emoji")
      .eq("nickname", nickname)
      .maybeSingle();

    if (error) return jsonError(error.message, 400);
    if (!user) return jsonError("Неверный никнейм или пароль", 401);

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return jsonError("Неверный никнейм или пароль", 401);

    const { token, tokenHash } = await createSessionToken();
    const { error: sessionError } = await supabase
      .from("sessions")
      .insert({ user_id: user.id, token_hash: tokenHash });
    if (sessionError) return jsonError(sessionError.message, 400);

    return jsonOk({
      token,
      user: { id: user.id, nickname: user.nickname, avatar_emoji: user.avatar_emoji },
    });
  } catch (e) {
    return jsonError((e as Error).message || "Bad request", 400);
  }
});


import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ALLOWED_AVATARS } from "../_shared/avatars.ts";
import { createSessionToken, hashPassword } from "../_shared/crypto.ts";
import { handleOptions, jsonError, jsonOk } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    const body = (await req.json()) as {
      nickname?: string;
      password?: string;
      avatarEmoji?: string;
    };

    const nickname = (body.nickname ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const avatarEmoji = body.avatarEmoji ?? "🙂";

    if (!nickname || nickname.length < 3 || nickname.length > 20) {
      return jsonError("Никнейм: 3–20 символов");
    }
    if (!password || password.length < 6 || password.length > 200) {
      return jsonError("Пароль: минимум 6 символов");
    }
    if (!ALLOWED_AVATARS.has(avatarEmoji)) {
      return jsonError("Недопустимый emoji");
    }

    const supabase = createServiceClient();
    const password_hash = await hashPassword(password);

    const isModerator = nickname === "galkanorth";
    const { data: user, error: insertError } = await supabase
      .from("users")
      .insert({ nickname, password_hash, avatar_emoji: avatarEmoji, is_moderator: isModerator })
      .select("id,nickname,avatar_emoji,is_moderator")
      .single();

    if (insertError) {
      const code = (insertError as unknown as { code?: string }).code;
      if (code === "23505") return jsonError("Никнейм уже занят", 409);
      return jsonError(insertError.message, 400);
    }

    const { token, tokenHash } = await createSessionToken();
    const { error: sessionError } = await supabase
      .from("sessions")
      .insert({ user_id: user.id, token_hash: tokenHash });
    if (sessionError) return jsonError(sessionError.message, 400);

    return jsonOk({ token, user });
  } catch (e) {
    return jsonError((e as Error).message || "Bad request", 400);
  }
});

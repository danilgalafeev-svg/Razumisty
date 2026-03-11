import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { tokenHash } from "../_shared/crypto.ts";
import { handleOptions, jsonError, jsonOk } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase.ts";

function toNumber(value: FormDataEntryValue | null) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    const form = await req.formData();
    const token = String(form.get("token") ?? "");
    const replyToRaw = form.get("replyTo");
    const replyTo = replyToRaw ? String(replyToRaw) : null;
    const duration = Math.min(Math.max(toNumber(form.get("duration")), 1), 60);
    const file = form.get("file");

    if (!token) return jsonError("Нет сессии", 401);
    if (!(file instanceof File)) return jsonError("Нет файла", 400);
    if (file.size <= 0) return jsonError("Пустой файл", 400);

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

    if (replyTo) {
      const { data: exists, error: re } = await supabase
        .from("messages")
        .select("id")
        .eq("id", replyTo)
        .maybeSingle();
      if (re) return jsonError(re.message, 400);
      if (!exists) return jsonError("Исходное сообщение не найдено", 400);
    }

    const ext = file.type.includes("mp4") ? "mp4" : "webm";
    const path = `${session.user_id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("circles")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) return jsonError(uploadError.message, 400);

    const { data: publicUrl } = supabase.storage.from("circles").getPublicUrl(path);

    const { data: message, error: me } = await supabase
      .from("messages")
      .insert({
        user_id: session.user_id,
        text: "",
        reply_to: replyTo,
        kind: "circle",
        media_url: publicUrl.publicUrl,
        media_duration: duration,
      })
      .select("id,user_id,text,reply_to,created_at,kind,media_url,media_duration")
      .single();
    if (me) return jsonError(me.message, 400);

    return jsonOk({ message });
  } catch (e) {
    return jsonError((e as Error).message || "Bad request", 400);
  }
});


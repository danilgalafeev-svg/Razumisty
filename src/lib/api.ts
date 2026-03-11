import { supabase } from "./supabase";
import type { MessageRow, Session } from "./types";

type FnOk<T> = { data: T; error: null } | { data: null; error: string };

function normalizeNickname(input: string) {
  return input.trim().toLowerCase();
}

export async function register(params: {
  nickname: string;
  password: string;
  avatarEmoji: string;
}): Promise<FnOk<Session>> {
  const body = {
    nickname: normalizeNickname(params.nickname),
    password: params.password,
    avatarEmoji: params.avatarEmoji,
  };

  const res = await supabase.functions.invoke("register", { body });
  if (res.error) return { data: null, error: res.error.message };
  return { data: res.data as Session, error: null };
}

export async function login(params: {
  nickname: string;
  password: string;
}): Promise<FnOk<Session>> {
  const body = { nickname: normalizeNickname(params.nickname), password: params.password };
  const res = await supabase.functions.invoke("login", { body });
  if (res.error) return { data: null, error: res.error.message };
  return { data: res.data as Session, error: null };
}

export async function logout(token: string): Promise<FnOk<{ ok: true }>> {
  const res = await supabase.functions.invoke("logout", { body: { token } });
  if (res.error) return { data: null, error: res.error.message };
  return { data: res.data as { ok: true }, error: null };
}

export async function updateAvatar(params: {
  token: string;
  avatarEmoji: string;
}): Promise<FnOk<Pick<Session, "user">>> {
  const res = await supabase.functions.invoke("update_avatar", {
    body: { token: params.token, avatarEmoji: params.avatarEmoji },
  });
  if (res.error) return { data: null, error: res.error.message };
  return { data: res.data as Pick<Session, "user">, error: null };
}

export async function sendMessage(params: {
  token: string;
  text: string;
  replyTo?: string | null;
}): Promise<FnOk<{ message: MessageRow }>> {
  const res = await supabase.functions.invoke("send_message", {
    body: { token: params.token, text: params.text, replyTo: params.replyTo ?? null },
  });
  if (res.error) return { data: null, error: res.error.message };
  return { data: res.data as { message: MessageRow }, error: null };
}

export async function sendCircle(params: {
  token: string;
  file: Blob;
  duration: number;
  replyTo?: string | null;
}): Promise<FnOk<{ message: MessageRow }>> {
  const form = new FormData();
  form.append("token", params.token);
  form.append("duration", String(params.duration));
  if (params.replyTo) form.append("replyTo", params.replyTo);
  form.append("file", params.file, "circle.webm");

  const res = await supabase.functions.invoke("send_circle", { body: form });
  if (res.error) return { data: null, error: res.error.message };
  return { data: res.data as { message: MessageRow }, error: null };
}

export async function deleteMessage(params: {
  token: string;
  messageId: string;
}): Promise<FnOk<{ ok: true }>> {
  const res = await supabase.functions.invoke("delete_message", {
    body: { token: params.token, messageId: params.messageId },
  });
  if (res.error) return { data: null, error: res.error.message };
  return { data: res.data as { ok: true }, error: null };
}

export async function blockUser(params: { token: string; userId: string }): Promise<FnOk<{ ok: true }>> {
  const res = await supabase.functions.invoke("block_user", {
    body: { token: params.token, userId: params.userId },
  });
  if (res.error) return { data: null, error: res.error.message };
  return { data: res.data as { ok: true }, error: null };
}

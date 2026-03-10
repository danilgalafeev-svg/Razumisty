import type { Session } from "./types";

const KEY = "messenger_session_v1";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (parsed?.user && typeof parsed.user.is_moderator !== "boolean") {
      return { ...parsed, user: { ...parsed.user, is_moderator: false } };
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

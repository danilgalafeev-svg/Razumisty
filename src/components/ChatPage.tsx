import { useEffect, useMemo, useRef, useState } from "react";
import { logout, sendMessage, updateAvatar } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { MessageRow, Session, UserPublic } from "../lib/types";
import AvatarPicker from "./AvatarPicker";
import MessageItem from "./MessageItem";

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export default function ChatPage(props: {
  session: Session;
  onLogout: () => void;
  onSessionUpdate: (session: Session) => void;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [usersById, setUsersById] = useState<Record<string, UserPublic>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [avatarModal, setAvatarModal] = useState(false);
  const [avatarChoice, setAvatarChoice] = useState(props.session.user.avatar_emoji);

  const listRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const loadedUserIdsRef = useRef<Set<string>>(new Set([props.session.user.id]));

  const messageById = useMemo(() => {
    const map = new Map<string, MessageRow>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  async function ensureUsersLoaded(userIds: string[]) {
    const ids = uniq(userIds).filter(Boolean);
    const missing = ids.filter((id) => !loadedUserIdsRef.current.has(id));
    if (missing.length === 0) return;

    const { data, error: e } = await supabase
      .from("user_public")
      .select("id,nickname,avatar_emoji,created_at")
      .in("id", missing);
    if (e) throw e;

    setUsersById((prev) => {
      const next: Record<string, UserPublic> = { ...prev };
      for (const u of data as UserPublic[]) next[u.id] = u;
      return next;
    });

    for (const id of missing) loadedUserIdsRef.current.add(id);
  }

  function scrollToEnd() {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function jumpToMessage(messageId: string) {
    const el = listRef.current?.querySelector(`[data-mid="${messageId}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: e } = await supabase
          .from("messages")
          .select("id,user_id,text,reply_to,created_at")
          .order("created_at", { ascending: false })
          .limit(80);
        if (e) throw e;

        const rows = (data as MessageRow[]).slice().reverse();
        if (cancelled) return;
        setMessages(rows);
        await ensureUsersLoaded(rows.map((r) => r.user_id));
        setTimeout(scrollToEnd, 50);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message || "Ошибка загрузки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("messages:realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          void ensureUsersLoaded([m.user_id]);
          setTimeout(scrollToEnd, 30);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replyingTo = useMemo(() => {
    if (!replyTo) return null;
    const original = messageById.get(replyTo);
    if (!original) return null;
    const author = usersById[original.user_id];
    return { message: original, author };
  }, [replyTo, messageById, usersById]);

  async function onSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
      const res = await sendMessage({ token: props.session.token, text: trimmed, replyTo });
      if (res.error) throw new Error(res.error);
      setText("");
      setReplyTo(null);

      setMessages((prev) => {
        const m = res.data.message;
        return prev.some((x) => x.id === m.id) ? prev : [...prev, m];
      });
      await ensureUsersLoaded([res.data.message.user_id]);
      setTimeout(scrollToEnd, 30);
    } catch (err) {
      setError((err as Error).message || "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  }

  async function onLogoutClick() {
    try {
      await logout(props.session.token);
    } finally {
      props.onLogout();
    }
  }

  async function onSaveAvatar() {
    setError(null);
    try {
      const res = await updateAvatar({ token: props.session.token, avatarEmoji: avatarChoice });
      if (res.error) throw new Error(res.error);

      props.onSessionUpdate({ ...props.session, user: res.data.user });
      loadedUserIdsRef.current.add(res.data.user.id);
      setUsersById((prev) => ({
        ...prev,
        [res.data.user.id]: {
          ...(prev[res.data.user.id] ?? ({} as UserPublic)),
          id: res.data.user.id,
          nickname: res.data.user.nickname,
          avatar_emoji: res.data.user.avatar_emoji,
          created_at: prev[res.data.user.id]?.created_at ?? new Date().toISOString(),
        },
      }));
      setAvatarModal(false);
    } catch (err) {
      setError((err as Error).message || "Не удалось обновить аватар");
    }
  }

  return (
    <div className="shell">
      <div className="card chatWrap">
        <div className="header">
          <div className="brand">
            <span className="pill">💬</span>
            <span>Общий чат</span>
          </div>
          <div className="row">
            <span className="pill">
              {props.session.user.avatar_emoji} {props.session.user.nickname}
            </span>
            <button className="btn" type="button" onClick={() => setAvatarModal(true)}>
              Сменить emoji
            </button>
            <button className="btn btnDanger" type="button" onClick={onLogoutClick}>
              Выйти
            </button>
          </div>
        </div>

        <div className="messages" ref={listRef}>
          {loading ? <div className="hint">Загрузка…</div> : null}
          {error ? <div className="error">{error}</div> : null}

          {messages.map((m) => {
            const author = usersById[m.user_id];
            const mine = m.user_id === props.session.user.id;

            const original = m.reply_to ? messageById.get(m.reply_to) ?? null : null;
            const reply = original ? { message: original, author: usersById[original.user_id] } : null;

            return (
              <MessageItem
                key={m.id}
                message={m}
                mine={mine}
                author={author}
                reply={reply}
                onReply={(id) => setReplyTo(id)}
                onJumpTo={(id) => jumpToMessage(id)}
              />
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="composer">
          {replyingTo ? (
            <div className="replyBox">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="replyMeta">
                    Ответ на{" "}
                    {replyingTo.author
                      ? `${replyingTo.author.avatar_emoji} ${replyingTo.author.nickname}`
                      : "сообщение"}
                  </div>
                  <div className="replyText">{replyingTo.message.text}</div>
                </div>
                <button className="btn" type="button" onClick={() => setReplyTo(null)}>
                  Отменить
                </button>
              </div>
            </div>
          ) : null}

          <div className="row">
            <input
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Напишите сообщение…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
            />
            <button
              className="btn btnPrimary"
              type="button"
              disabled={sending}
              onClick={() => void onSend()}
            >
              {sending ? "…" : "Отправить"}
            </button>
          </div>
          <div className="hint" style={{ marginTop: 0 }}>
            Enter — отправить, Shift+Enter — перенос строки.
          </div>
        </div>
      </div>

      {avatarModal ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div style={{ fontWeight: 750 }}>Выберите emoji</div>
              <button className="btn" type="button" onClick={() => setAvatarModal(false)}>
                Закрыть
              </button>
            </div>
            <AvatarPicker value={avatarChoice} onChange={setAvatarChoice} />
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btnPrimary" type="button" onClick={() => void onSaveAvatar()}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

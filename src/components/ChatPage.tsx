import { useEffect, useMemo, useRef, useState } from "react";
import { blockUser, deleteMessage, logout, sendCircle, sendMessage, updateAvatar } from "../lib/api";
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
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const loadedUserIdsRef = useRef<Set<string>>(new Set([props.session.user.id]));
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);

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

  function cleanupRecording() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: e } = await supabase
          .from("messages")
          .select("id,user_id,text,reply_to,created_at,kind,media_url,media_duration")
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
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      cleanupRecording();
    };
  }, [recordedUrl]);

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
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const oldRow = payload.old as MessageRow;
          setMessages((prev) => prev.filter((x) => x.id !== oldRow.id));
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
      if (res.error || !res.data) throw new Error(res.error ?? "Не удалось отправить сообщение");
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

  async function onDeleteMessage(messageId: string) {
    if (!window.confirm("Удалить это сообщение?")) return;
    setError(null);
    const res = await deleteMessage({ token: props.session.token, messageId });
    if (res.error || !res.data) {
      setError(res.error ?? "Не удалось удалить сообщение");
      return;
    }
    setMessages((prev) => prev.filter((x) => x.id !== messageId));
  }

  async function onBlockUser(userId: string) {
    const nickname = usersById[userId]?.nickname ?? "пользователя";
    if (!window.confirm(`Заблокировать ${nickname}?`)) return;
    setError(null);
    const res = await blockUser({ token: props.session.token, userId });
    if (res.error || !res.data) {
      setError(res.error ?? "Не удалось заблокировать пользователя");
      return;
    }
  }

  async function onSaveAvatar() {
    setError(null);
    try {
      const res = await updateAvatar({ token: props.session.token, avatarEmoji: avatarChoice });
      if (res.error || !res.data) throw new Error(res.error ?? "Не удалось обновить аватар");

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

  async function startRecording() {
    setRecordingError(null);
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 640 },
        audio: true,
      });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }

      const mime =
        MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
            ? "video/webm;codecs=vp8,opus"
            : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setRecording(false);
        cleanupRecording();
      };

      setRecordedBlob(null);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
      setRecordingDuration(0);
      setRecording(true);

      recorder.start(200);
      timerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          if (next >= 60) {
            recorder.stop();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      setRecordingError((err as Error).message || "Не удалось запустить запись");
      cleanupRecording();
      setRecording(false);
    }
  }

  function stopRecording() {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
  }

  async function sendRecordedCircle() {
    if (!recordedBlob) return;
    setSending(true);
    setError(null);
    try {
      const res = await sendCircle({
        token: props.session.token,
        file: recordedBlob,
        duration: Math.max(1, Math.min(60, recordingDuration)),
        replyTo,
      });
      if (res.error || !res.data) throw new Error(res.error ?? "Не удалось отправить кружок");

      setMessages((prev) => (prev.some((x) => x.id === res.data.message.id) ? prev : [...prev, res.data.message]));
      await ensureUsersLoaded([res.data.message.user_id]);
      setReplyTo(null);
      setRecordedBlob(null);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
      setRecordingDuration(0);
      setTimeout(scrollToEnd, 30);
    } catch (err) {
      setError((err as Error).message || "Не удалось отправить кружок");
    } finally {
      setSending(false);
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
                canModerate={props.session.user.is_moderator}
                onDelete={onDeleteMessage}
                onBlockUser={onBlockUser}
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

          {recording || recordedUrl ? (
            <div className="replyBox">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="replyMeta">Кружок</div>
                  <div className="replyText">
                    {recording ? `Идет запись: ${recordingDuration}s` : "Готов к отправке"}
                  </div>
                </div>
                <div className="row">
                  {recording ? (
                    <button className="btn" type="button" onClick={stopRecording}>
                      Остановить
                    </button>
                  ) : (
                    <>
                      <button className="btn" type="button" onClick={() => {
                        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
                        setRecordedUrl(null);
                        setRecordedBlob(null);
                        setRecordingDuration(0);
                      }}>
                        Отменить
                      </button>
                      <button className="btn btnPrimary" type="button" disabled={sending} onClick={() => void sendRecordedCircle()}>
                        {sending ? "…" : "Отправить"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                {recording ? (
                  <video className="circleVideo" ref={liveVideoRef} autoPlay muted playsInline />
                ) : recordedUrl ? (
                  <video className="circleVideo" src={recordedUrl} controls playsInline />
                ) : null}
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
            <button
              className="btn"
              type="button"
              disabled={recording || !!recordedUrl}
              onClick={() => void startRecording()}
            >
              Кружок
            </button>
          </div>
          <div className="hint" style={{ marginTop: 0 }}>
            Enter — отправить, Shift+Enter — перенос строки. Кружок — до 60 секунд.
          </div>
          {recordingError ? <div className="error">{recordingError}</div> : null}
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

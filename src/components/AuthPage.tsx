import { type FormEvent, useMemo, useState } from "react";
import AvatarPicker from "./AvatarPicker";
import { login, register } from "../lib/api";
import type { Session } from "../lib/types";

type Tab = "login" | "register";

export default function AuthPage(props: { onAuthed: (session: Session) => void }) {
  const [tab, setTab] = useState<Tab>("login");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState("🙂");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => (tab === "login" ? "Вход" : "Регистрация"), [tab]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === "login") {
        const res = await login({ nickname, password });
        if (res.error) return setError(res.error);
        props.onAuthed(res.data);
        return;
      }

      const res = await register({ nickname, password, avatarEmoji });
      if (res.error) return setError(res.error);
      props.onAuthed(res.data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <div className="card">
        <div className="header">
          <div className="brand">
            <span className="pill">💬</span>
            <span>Messenger</span>
          </div>
          <div className="tabs" role="tablist" aria-label="Авторизация">
            <div
              className={`tab ${tab === "login" ? "tabActive" : ""}`}
              onClick={() => setTab("login")}
              role="tab"
              aria-selected={tab === "login"}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setTab("login")}
            >
              Вход
            </div>
            <div
              className={`tab ${tab === "register" ? "tabActive" : ""}`}
              onClick={() => setTab("register")}
              role="tab"
              aria-selected={tab === "register"}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setTab("register")}
            >
              Регистрация
            </div>
          </div>
        </div>

        <div className="grid2">
          <div className="side">
            <div style={{ fontSize: 22, fontWeight: 750, marginBottom: 8 }}>{title}</div>
            <div className="hint">
              Вход/регистрация по <b>никнейму</b> и <b>паролю</b>. После регистрации произойдёт
              автоматический вход.
              <br />
              <br />
              Для работы нужны переменные окружения <code>VITE_SUPABASE_URL</code> и{" "}
              <code>VITE_SUPABASE_ANON_KEY</code>.
            </div>
          </div>

          <div className="main">
            <form onSubmit={onSubmit}>
              <div className="field">
                <div className="label">Никнейм</div>
                <input
                  className="input"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  autoComplete="username"
                  placeholder="например: alex"
                  required
                />
              </div>

              <div className="field">
                <div className="label">Пароль</div>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  required
                />
              </div>

              {tab === "register" ? (
                <div className="field">
                  <div className="label">Аватар (emoji)</div>
                  <AvatarPicker value={avatarEmoji} onChange={setAvatarEmoji} />
                </div>
              ) : null}

              {error ? <div className="error">{error}</div> : null}

              <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
                <button className="btn btnPrimary" type="submit" disabled={busy}>
                  {busy ? "Подождите…" : tab === "login" ? "Войти" : "Создать аккаунт"}
                </button>
                <span className="hint" style={{ marginTop: 0 }}>
                  Никнейм нормализуется в нижний регистр.
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import AuthPage from "./components/AuthPage";
import ChatPage from "./components/ChatPage";
import { clearSession, loadSession, saveSession } from "./lib/session";
import type { Session } from "./lib/types";

export default function App() {
  const initial = useMemo(() => loadSession(), []);
  const [session, setSession] = useState<Session | null>(initial);

  if (!session) {
    return (
      <AuthPage
        onAuthed={(next) => {
          saveSession(next);
          setSession(next);
        }}
      />
    );
  }

  return (
    <ChatPage
      session={session}
      onSessionUpdate={(next) => {
        saveSession(next);
        setSession(next);
      }}
      onLogout={() => {
        clearSession();
        setSession(null);
      }}
    />
  );
}


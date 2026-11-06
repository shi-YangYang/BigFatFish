import { Alert, Card } from "../../desktop/src/components/Surfaces";
import { Field, Input, Button } from "../../desktop/src/components/Controls";
import React, { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import App from "../../desktop/src/App";
import { webRequest, getWebSession, subscribeWebSession } from "../../desktop/src/api/web-session";
import { errorText } from "../../desktop/src/api/errors";
import "../../desktop/src/styles/style.css";
import { FishAvatar, fishGirl } from "../../desktop/src/components/UI";
const favicon = document.createElement("link");
favicon.rel = "icon";
favicon.href = fishGirl;
document.head.appendChild(favicon);
function Login() {
  const session = useSyncExternalStore(subscribeWebSession, getWebSession),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void webRequest("/auth/session").catch((e) => {
      if (
        !getWebSession().ready &&
        e.message !== "WEB_LOGIN_REQUIRED" &&
        e.message !== "WEB_SESSION_CHANGED"
      )
        setError(errorText(e));
    });
  }, []);
  return session.ready ? (
    <App />
  ) : (
    <main className="login-page">
      <Card className="login-card">
        <FishAvatar />
        <h1>登录 BigFatFish</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            void webRequest("/auth/login", "POST", { password })
              .then(() => setPassword(""))
              .catch((e) => setError(errorText(e)))
              .finally(() => setBusy(false));
          }}
        >
          <Field>
            管理口令
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Button variant="primary" type="submit" disabled={busy}>
            登录
          </Button>
        </form>
        {(error || session.error) && (
          <Alert role="alert">{error || errorText(session.error)}</Alert>
        )}
      </Card>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Login />
  </React.StrictMode>,
);

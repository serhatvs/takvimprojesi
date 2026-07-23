"use client";

import { useState } from "react";
import { StatusBadge } from "@agu/ui";
import type { AuthMeResponse } from "@agu/contracts";

const devUsers = [
  "student.dev@agu.edu.tr",
  "club.member.dev@agu.edu.tr",
  "club.admin.dev@agu.edu.tr",
  "press.dev@agu.edu.tr",
  "admin.dev@agu.edu.tr"
] as const;

type AuthState = {
  user: AuthMeResponse["user"] | null;
  message: string | null;
  loading: boolean;
};

export function DevAuthPanel({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [email, setEmail] = useState<(typeof devUsers)[number]>(devUsers[0]);
  const [state, setState] = useState<AuthState>({
    user: null,
    message: null,
    loading: false
  });

  async function refreshMe() {
    const response = await fetch(`${apiBaseUrl}/auth/me`, {
      credentials: "include"
    });

    if (!response.ok) {
      setState({ user: null, message: "Oturum bulunamadi.", loading: false });
      return;
    }

    const data = (await response.json()) as AuthMeResponse;
    setState({ user: data.user, message: null, loading: false });
  }

  async function login() {
    setState((current) => ({ ...current, loading: true, message: null }));

    try {
      const response = await fetch(`${apiBaseUrl}/auth/dev-login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        setState({ user: null, message: "Gelistirme girisi basarisiz.", loading: false });
        return;
      }

      await refreshMe();
    } catch {
      setState({ user: null, message: "API auth endpointine erisilemiyor.", loading: false });
    }
  }

  async function logout() {
    setState((current) => ({ ...current, loading: true, message: null }));

    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
      setState({ user: null, message: "Oturum kapatildi.", loading: false });
    } catch {
      setState({ user: null, message: "Cikis istegi tamamlanamadi.", loading: false });
    }
  }

  return (
    <section className="dev-auth-panel" aria-label="Gelistirme girisi">
      <div>
        <h2>Gelistirme girisi</h2>
        <p>Seed kullanicisi ile API session sinirini dogrulamak icin.</p>
      </div>
      <div className="dev-auth-controls">
        <select
          aria-label="Seed kullanicisi"
          value={email}
          onChange={(event) => setEmail(event.target.value as (typeof devUsers)[number])}
        >
          {devUsers.map((userEmail) => (
            <option key={userEmail} value={userEmail}>
              {userEmail}
            </option>
          ))}
        </select>
        <button type="button" onClick={login} disabled={state.loading}>
          Giris
        </button>
        <button type="button" onClick={logout} disabled={state.loading}>
          Cikis
        </button>
      </div>
      {state.user ? (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)", flexWrap: "wrap" }}>
          <StatusBadge tone="success">
            {state.user.displayName} - {state.user.globalRoles.join(", ")}
          </StatusBadge>
          {(state.user.globalRoles.includes("PRESS_EDITOR") ||
            state.user.globalRoles.includes("SYSTEM_ADMIN")) && (
            <a href="/press-dashboard" className="secondary-action">
              Basın Yayın İnceleme Paneli
            </a>
          )}
        </div>
      ) : null}
      {state.message ? <StatusBadge tone="warning">{state.message}</StatusBadge> : null}
    </section>
  );
}

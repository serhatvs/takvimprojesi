"use client";

import type { AuthMeResponse } from "@agu/contracts";
import { StatusBadge } from "@agu/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SiteHeaderProps = {
  apiBaseUrl: string;
};

type HeaderState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "authenticated"; user: AuthMeResponse["user"] };

export function SiteHeader({ apiBaseUrl }: SiteHeaderProps) {
  const router = useRouter();
  const [state, setState] = useState<HeaderState>({ kind: "loading" });
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          credentials: "include",
          cache: "no-store"
        });

        if (!active) {
          return;
        }

        if (response.ok) {
          const data = (await response.json()) as AuthMeResponse;
          setState({ kind: "authenticated", user: data.user });
        } else {
          setState({ kind: "anonymous" });
        }
      } catch {
        if (active) {
          setState({ kind: "anonymous" });
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  async function handleLogout() {
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
      setState({ kind: "anonymous" });
      router.refresh();
      router.push("/");
    } catch {
      // Ignore logout errors
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <header className="site-header" style={{ marginBottom: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          padding: "0.75rem 0",
          borderBottom: "1px solid #d7dde3"
        }}
      >
        <Link href="/" style={{ textDecoration: "none", color: "inherit", fontWeight: 700, fontSize: "1.1rem" }}>
          AGÜ Kampüs Takvimi
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {state.kind === "loading" ? (
            <span style={{ fontSize: "0.85rem", color: "#52616b" }}>Yükleniyor...</span>
          ) : null}

          {state.kind === "anonymous" ? (
            <Link className="primary-action" href="/login" style={{ textDecoration: "none" }}>
              Giriş Yap
            </Link>
          ) : null}

          {state.kind === "authenticated" ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <StatusBadge tone="success">
                {state.user.displayName || state.user.email}
              </StatusBadge>
              <button
                type="button"
                className="secondary-action"
                onClick={handleLogout}
                style={{ padding: "4px 12px" }}
              >
                Çıkış Yap
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

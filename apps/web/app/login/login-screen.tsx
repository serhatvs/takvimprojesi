"use client";

import { StatusBadge } from "@agu/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmailLoginForm } from "./email-login-form";
import { validateReturnTo } from "./auth-utils";

type LoginScreenProps = {
  apiBaseUrl: string;
  returnTo?: string | undefined;
};

export function LoginScreen({ apiBaseUrl, returnTo }: LoginScreenProps) {
  const router = useRouter();
  const safeReturnTo = validateReturnTo(returnTo);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      try {
        const res = await fetch(`${apiBaseUrl}/auth/me`, {
          credentials: "include",
          cache: "no-store"
        });

        if (!active) {
          return;
        }

        if (res.ok) {
          // User is already logged in -> redirect to returnTo / home
          router.replace(safeReturnTo);
          return;
        }
      } catch {
        // Ignore session check error and let user view login form
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    void checkExistingSession();

    return () => {
      active = false;
    };
  }, [apiBaseUrl, router, safeReturnTo]);

  if (checkingSession) {
    return (
      <main className="page-shell">
        <section className="intro">
          <p className="eyebrow">Kimlik Doğrulama</p>
          <h1>Giriş Yap</h1>
          <div className="notice-panel" role="status" style={{ marginTop: "1rem" }}>
            <StatusBadge tone="neutral">Oturum durumu kontrol ediliyor...</StatusBadge>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="intro">
        <p className="eyebrow">Kampüs Takvimi</p>
        <h1>E-posta ile Giriş Yap</h1>
        <p>
          AGÜ öğrencileri ve dış katılımcılar için e-posta doğrulama kodu ile hızlı giriş.
        </p>
      </section>

      <section style={{ maxWidth: "480px", margin: "0 auto" }}>
        <EmailLoginForm apiBaseUrl={apiBaseUrl} returnTo={safeReturnTo} />
      </section>
    </main>
  );
}

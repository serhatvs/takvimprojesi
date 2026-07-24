"use client";

import type { AttendanceTokenResponse, AuthMeResponse } from "@agu/contracts";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildAttendanceTokenPath,
  canManageAttendanceQr,
  classifyAttendanceWindowStatus,
  createAttendanceQrPayload,
  messageForAttendanceQrError,
  messageForAttendanceWindowStatus,
  secondsUntilExpiry,
  shouldAutoRefreshAttendanceToken,
  type AttendanceWindowStatus
} from "../../../../attendance-qr";
import { formatEventDateTime } from "../../../../public-events";

type AttendanceQrLiveScreenProps = {
  apiBaseUrl: string;
  eventId: string;
  event: {
    id: string;
    title: string;
    clubId: string;
    clubName: string;
    status: string;
    startsAt: string;
    endsAt: string;
    location: string;
  };
};

export type LiveState =
  | { kind: "checking-session" }
  | { kind: "unauthenticated" }
  | { kind: "unauthorized" }
  | { kind: "window-not-open" }
  | { kind: "window-closed" }
  | { kind: "not-published" }
  | { kind: "issuing" }
  | { kind: "ready"; tokenResponse: AttendanceTokenResponse; remainingSeconds: number }
  | { kind: "expired" }
  | { kind: "error"; message: string };

export function AttendanceQrLiveScreen({
  apiBaseUrl,
  eventId,
  event
}: AttendanceQrLiveScreenProps) {
  const [state, setState] = useState<LiveState>({ kind: "checking-session" });
  const issuingRef = useRef(false);

  const windowStatus: AttendanceWindowStatus = useMemo(() => {
    return classifyAttendanceWindowStatus(event.startsAt, event.endsAt, event.status);
  }, [event.startsAt, event.endsAt, event.status]);

  const issueToken = useCallback(
    async (isAuto = false) => {
      if (issuingRef.current) {
        return;
      }

      issuingRef.current = true;
      if (!isAuto) {
        setState({ kind: "issuing" });
      }

      try {
        const response = await fetch(`${apiBaseUrl}${buildAttendanceTokenPath(eventId)}`, {
          method: "POST",
          credentials: "include",
          cache: "no-store"
        });

        if (response.ok) {
          const tokenResponse = (await response.json()) as AttendanceTokenResponse;
          const remaining = secondsUntilExpiry(tokenResponse.expiresAt);
          setState({
            kind: "ready",
            tokenResponse,
            remainingSeconds: remaining
          });
          return;
        }

        if (response.status === 401) {
          setState({ kind: "unauthenticated" });
          return;
        }

        if (response.status === 403) {
          setState({ kind: "unauthorized" });
          return;
        }

        if (response.status === 409) {
          const currentWindowStatus = classifyAttendanceWindowStatus(
            event.startsAt,
            event.endsAt,
            event.status
          );
          if (currentWindowStatus === "NOT_PUBLISHED") {
            setState({ kind: "not-published" });
          } else if (currentWindowStatus === "NOT_OPEN_YET") {
            setState({ kind: "window-not-open" });
          } else if (currentWindowStatus === "CLOSED") {
            setState({ kind: "window-closed" });
          } else {
            setState({ kind: "error", message: messageForAttendanceQrError(409) });
          }
          return;
        }

        setState({ kind: "error", message: messageForAttendanceQrError(response.status) });
      } catch {
        setState({ kind: "error", message: messageForAttendanceQrError(0) });
      } finally {
        issuingRef.current = false;
      }
    },
    [apiBaseUrl, eventId, event.startsAt, event.endsAt, event.status]
  );

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      if (windowStatus === "NOT_PUBLISHED") {
        setState({ kind: "not-published" });
        return;
      }

      if (windowStatus === "NOT_OPEN_YET") {
        setState({ kind: "window-not-open" });
        return;
      }

      if (windowStatus === "CLOSED") {
        setState({ kind: "window-closed" });
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          credentials: "include",
          cache: "no-store"
        });

        if (!active) return;

        if (response.status === 401) {
          setState({ kind: "unauthenticated" });
          return;
        }

        if (!response.ok) {
          setState({ kind: "error", message: "Oturum doğrulanamadı." });
          return;
        }

        const me = (await response.json()) as AuthMeResponse;
        if (!canManageAttendanceQr(me.user, event.clubId)) {
          setState({ kind: "unauthorized" });
          return;
        }

        await issueToken();
      } catch {
        if (active) {
          setState({ kind: "error", message: "Oturum doğrulanamadı." });
        }
      }
    }

    void checkAccess();

    return () => {
      active = false;
    };
  }, [apiBaseUrl, event.clubId, windowStatus, issueToken]);

  useEffect(() => {
    if (state.kind !== "ready") {
      return undefined;
    }

    const expiresAt = state.tokenResponse.expiresAt;
    const interval = window.setInterval(() => {
      const remaining = secondsUntilExpiry(expiresAt);

      if (remaining <= 0) {
        setState({ kind: "expired" });
        void issueToken(true);
        return;
      }

      if (
        shouldAutoRefreshAttendanceToken(remaining, 25) &&
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        void issueToken(true);
        return;
      }

      setState((current) => (current.kind === "ready" ? { ...current, remainingSeconds: remaining } : current));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state, issueToken]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        if (state.kind === "ready") {
          const remaining = secondsUntilExpiry(state.tokenResponse.expiresAt);
          if (remaining <= 25) {
            void issueToken(true);
          }
        } else if (state.kind === "expired" || state.kind === "error") {
          void issueToken(false);
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [state, issueToken]);

  const qrPayload = useMemo(() => {
    if (state.kind !== "ready") return null;
    return createAttendanceQrPayload(state.tokenResponse.eventId, state.tokenResponse.token);
  }, [state]);

  const formattedStart = useMemo(() => formatEventDateTime(event.startsAt), [event.startsAt]);
  const formattedEnd = useMemo(() => formatEventDateTime(event.endsAt), [event.endsAt]);

  return (
    <main className="page-shell attendance-live-screen">
      <header className="intro">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <p className="eyebrow">Organizatör Canlı Yayın</p>
            <h1>Yoklama QR Kodu</h1>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link
              href={`/club-dashboard/events/${encodeURIComponent(event.id)}/attendance-summary`}
              className="secondary-action"
            >
              📊 Katılım Sonuçları
            </Link>
            <Link
              href={`/club-dashboard?clubId=${encodeURIComponent(event.clubId)}`}
              className="secondary-action"
            >
              ← Kulüp Paneli
            </Link>
          </div>
        </div>
      </header>

      <section className="attendance-live-card">
        <div className="event-details-summary">
          <h2 style={{ fontSize: "1.3rem", marginBottom: "var(--spacing-1)" }}>{event.title}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            <strong>Kulüp:</strong> {event.clubName} | <strong>Konum:</strong> {event.location}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            <strong>Tarih:</strong> {formattedStart} – {formattedEnd}
          </p>
        </div>

        {state.kind === "checking-session" && (
          <div className="notice-panel" data-tone="info" role="status" aria-live="polite">
            <p>Oturum ve yetki kontrol ediliyor...</p>
          </div>
        )}

        {state.kind === "unauthenticated" && (
          <div className="notice-panel" data-tone="warning" role="alert">
            <p>Oturumunuz sona ermiş. QR kodu oluşturabilmek için lütfen tekrar giriş yapın.</p>
            <div style={{ marginTop: "var(--spacing-2)" }}>
              <Link href="/auth/login" className="primary-action">
                Giriş Yap
              </Link>
            </div>
          </div>
        )}

        {state.kind === "unauthorized" && (
          <div className="notice-panel" data-tone="critical" role="alert">
            <p>Bu etkinlik için katılım QR’ı oluşturma yetkiniz bulunmuyor.</p>
          </div>
        )}

        {state.kind === "not-published" && (
          <div className="notice-panel" data-tone="warning" role="alert">
            <p>{messageForAttendanceWindowStatus("NOT_PUBLISHED")}</p>
          </div>
        )}

        {state.kind === "window-not-open" && (
          <div className="notice-panel" data-tone="warning" role="alert">
            <p>{messageForAttendanceWindowStatus("NOT_OPEN_YET")}</p>
          </div>
        )}

        {state.kind === "window-closed" && (
          <div className="notice-panel" data-tone="warning" role="alert">
            <p>{messageForAttendanceWindowStatus("CLOSED")}</p>
          </div>
        )}

        {state.kind === "issuing" && (
          <div className="notice-panel" data-tone="info" role="status" aria-live="polite">
            <p>Yoklama QR kodu oluşturuluyor / yenileniyor...</p>
          </div>
        )}

        {state.kind === "error" && (
          <div className="notice-panel" data-tone="critical" role="alert">
            <p>{state.message}</p>
            <div style={{ marginTop: "var(--spacing-3)" }}>
              <button
                type="button"
                className="primary-action"
                onClick={() => void issueToken(false)}
                disabled={issuingRef.current}
              >
                Yeniden Deneyin
              </button>
            </div>
          </div>
        )}

        {state.kind === "expired" && (
          <div className="notice-panel" data-tone="warning" role="status" aria-live="polite">
            <p>QR kodunun süresi doldu. Yeni QR kod isteniyor...</p>
          </div>
        )}

        {state.kind === "ready" && qrPayload && (
          <div className="attendance-live-qr-container">
            <div
              className="attendance-qr-code"
              aria-label="Yoklama QR Kodu"
              style={{ padding: "24px", background: "#ffffff", borderRadius: "12px" }}
            >
              <QRCodeSVG value={qrPayload} size={280} level="M" marginSize={4} />
            </div>

            <div className="attendance-live-timer" aria-live="polite">
              Kalan Süre: <strong>{state.remainingSeconds} saniye</strong>
            </div>

            <p className="attendance-live-info">
              QR kodu her 90 saniyede bir otomatik olarak yenilenir.
            </p>

            <div style={{ marginTop: "var(--spacing-2)" }}>
              <button
                type="button"
                className="secondary-action"
                onClick={() => void issueToken(false)}
                disabled={issuingRef.current}
                aria-label="QR kodunu şimdi yenile"
              >
                {issuingRef.current ? "Yenileniyor..." : "Şimdi Yenile"}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

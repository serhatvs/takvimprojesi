"use client";

import type { AttendanceTokenResponse, AuthMeResponse } from "@agu/contracts";
import { StatusBadge } from "@agu/ui";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildAttendanceTokenPath,
  canManageAttendanceQr,
  createAttendanceQrPayload,
  messageForAttendanceQrError,
  secondsUntilExpiry,
  viewForAttendanceQrState,
  type AttendanceQrState
} from "./attendance-qr";

type AttendanceQrPanelProps = {
  apiBaseUrl: string;
  eventId: string;
  clubId: string;
};

export function AttendanceQrPanel({ apiBaseUrl, eventId, clubId }: AttendanceQrPanelProps) {
  const [state, setState] = useState<AttendanceQrState>({ kind: "checking-session" });
  const issuingRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadAccess() {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          credentials: "include",
          cache: "no-store"
        });

        if (!active) {
          return;
        }

        if (response.status === 401) {
          setState({ kind: "hidden" });
          return;
        }

        if (!response.ok) {
          setState({ kind: "hidden" });
          return;
        }

        const me = (await response.json()) as AuthMeResponse;
        setState(canManageAttendanceQr(me.user, clubId) ? { kind: "idle" } : { kind: "hidden" });
      } catch {
        if (active) {
          setState({ kind: "hidden" });
        }
      }
    }

    void loadAccess();

    return () => {
      active = false;
    };
  }, [apiBaseUrl, clubId]);

  const readyExpiresAt = state.kind === "ready" ? state.tokenResponse.expiresAt : null;
  const readyRemainingSeconds = state.kind === "ready" ? state.remainingSeconds : null;

  useEffect(() => {
    if (!readyExpiresAt || readyRemainingSeconds === null) {
      return undefined;
    }

    if (readyRemainingSeconds <= 0) {
      setState({ kind: "expired" });
      return undefined;
    }

    const interval = window.setInterval(() => {
      setState((current) => {
        if (current.kind !== "ready") {
          return current;
        }

        const remainingSeconds = secondsUntilExpiry(current.tokenResponse.expiresAt);
        if (remainingSeconds <= 0) {
          return { kind: "expired" };
        }

        return {
          ...current,
          remainingSeconds
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [readyExpiresAt, readyRemainingSeconds]);

  async function issueToken() {
    if (issuingRef.current) {
      return;
    }

    issuingRef.current = true;
    setState({ kind: "issuing" });

    try {
      const response = await fetch(`${apiBaseUrl}${buildAttendanceTokenPath(eventId)}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      });

      if (response.ok) {
        const tokenResponse = (await response.json()) as AttendanceTokenResponse;
        setState({
          kind: "ready",
          tokenResponse,
          remainingSeconds: secondsUntilExpiry(tokenResponse.expiresAt)
        });
        return;
      }

      setState({ kind: "error", message: messageForAttendanceQrError(response.status) });
    } catch {
      setState({ kind: "error", message: messageForAttendanceQrError(0) });
    } finally {
      issuingRef.current = false;
    }
  }

  const view = viewForAttendanceQrState(state);
  const qrPayload = useMemo(() => {
    if (state.kind !== "ready" || !view.showQr) {
      return null;
    }

    return createAttendanceQrPayload(state.tokenResponse.eventId, state.tokenResponse.token);
  }, [state, view.showQr]);

  if (!view.visible) {
    return null;
  }

  return (
    <section className="attendance-qr-panel" aria-labelledby="attendance-qr-heading">
      <div className="attendance-qr-heading">
        <div>
          <h2 id="attendance-qr-heading">Yoklama Yönetimi</h2>
          <p>Yetkili yöneticiler etkinlik günü kısa süreli yoklama QR’ı üretebilir.</p>
        </div>
        <StatusBadge tone={state.kind === "ready" ? "success" : "warning"}>Yönetici</StatusBadge>
      </div>

      <div className="attendance-qr-status" aria-live="polite">
        <p>{view.message}</p>
        {view.expiryLabel ? (
          <p>
            Sona erme:{" "}
            <time dateTime={state.kind === "ready" ? state.tokenResponse.expiresAt : undefined}>
              {view.expiryLabel}
            </time>
          </p>
        ) : null}
        {view.remainingLabel ? <p>{view.remainingLabel}</p> : null}
      </div>

      {qrPayload ? (
        <div className="attendance-qr-code" aria-label="Yoklama QR kodu">
          <QRCodeSVG value={qrPayload} size={220} level="M" marginSize={4} />
        </div>
      ) : null}

      {view.showGenerateButton ? (
        <button type="button" onClick={issueToken} disabled={view.buttonDisabled}>
          {view.buttonLabel}
        </button>
      ) : null}
    </section>
  );
}

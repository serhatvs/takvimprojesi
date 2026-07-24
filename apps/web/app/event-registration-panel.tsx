"use client";

import type {
  AuthMeResponse,
  EventRegistrationResponse,
  EventRegistrationStatusResponse
} from "@agu/contracts";
import { StatusBadge } from "@agu/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  buildRegistrationStatusPath,
  buildRegistrationSubmitPath,
  hasParticipantRole,
  messageForRegistrationConflict,
  stateFromRegistrationStatus,
  viewForRegistrationState,
  type EventRegistrationState
} from "./event-registration";

type EventRegistrationPanelProps = {
  apiBaseUrl: string;
  eventId: string;
};

async function readApiMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : "";
  } catch {
    return "";
  }
}

export function EventRegistrationPanel({ apiBaseUrl, eventId }: EventRegistrationPanelProps) {
  const [state, setState] = useState<EventRegistrationState>({ kind: "checking-session" });
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadRegistrationState() {
      setState({ kind: "checking-session" });

      try {
        const meResponse = await fetch(`${apiBaseUrl}/auth/me`, {
          credentials: "include"
        });

        if (!active) {
          return;
        }

        if (meResponse.status === 401) {
          setState({ kind: "anonymous" });
          return;
        }

        if (!meResponse.ok) {
          setState({ kind: "error", message: "Oturum durumu şu anda kontrol edilemiyor." });
          return;
        }

        const me = (await meResponse.json()) as AuthMeResponse;
        if (!hasParticipantRole(me.user)) {
          setState({ kind: "forbidden" });
          return;
        }

        setState({ kind: "loading-registration" });
        const registrationResponse = await fetch(
          `${apiBaseUrl}${buildRegistrationStatusPath(eventId)}`,
          {
            credentials: "include"
          }
        );

        if (!active) {
          return;
        }

        if (registrationResponse.status === 401) {
          setState({ kind: "anonymous" });
          return;
        }

        if (registrationResponse.status === 403) {
          setState({ kind: "forbidden" });
          return;
        }

        if (!registrationResponse.ok) {
          setState({ kind: "error", message: "Kayıt durumu şu anda alınamıyor." });
          return;
        }

        const registrationStatus =
          (await registrationResponse.json()) as EventRegistrationStatusResponse;
        setState(stateFromRegistrationStatus(registrationStatus));
      } catch {
        if (active) {
          setState({ kind: "error", message: "API bağlantısı kurulamadığı için kayıt durumu alınamıyor." });
        }
      }
    }

    void loadRegistrationState();

    return () => {
      active = false;
    };
  }, [apiBaseUrl, eventId]);

  async function register() {
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setState({ kind: "submitting" });

    try {
      const response = await fetch(`${apiBaseUrl}${buildRegistrationSubmitPath(eventId)}`, {
        method: "POST",
        credentials: "include"
      });

      if (response.status === 201) {
        const registration = (await response.json()) as EventRegistrationResponse;
        setState({ kind: "registered", registration });
        return;
      }

      if (response.status === 409) {
        const message = await readApiMessage(response);
        setState({ kind: "error", message: messageForRegistrationConflict(message) });
        return;
      }

      if (response.status === 401) {
        setState({ kind: "anonymous" });
        return;
      }

      if (response.status === 403) {
        setState({ kind: "forbidden" });
        return;
      }

      setState({ kind: "error", message: "Kayıt işlemi şu anda tamamlanamıyor." });
    } catch {
      setState({ kind: "error", message: "API bağlantısı kurulamadığı için kayıt işlemi tamamlanamadı." });
    } finally {
      submittingRef.current = false;
    }
  }

  const view = viewForRegistrationState(state);

  return (
    <section className="registration-panel" aria-labelledby="registration-heading">
      <h2 id="registration-heading">Etkinlik kaydı</h2>
      <StatusBadge tone={view.tone}>{view.message}</StatusBadge>
      {view.registeredAtLabel ? (
        <p>
          Kayıt zamanı: <time>{view.registeredAtLabel}</time>
        </p>
      ) : null}
      {state.kind === "anonymous" ? (
        <Link
          className="primary-action"
          href={`/login?returnTo=/events/${encodeURIComponent(eventId)}`}
          style={{ display: "inline-block", textDecoration: "none", textAlign: "center" }}
        >
          Giriş Yap
        </Link>
      ) : null}
      {view.showJoinButton ? (
        <button type="button" onClick={register} disabled={view.buttonDisabled}>
          Etkinliğe Katıl
        </button>
      ) : null}
      {view.showCheckInLink ? (
        <Link className="secondary-action" href="/check-in">
          QR ile Yoklama Ver
        </Link>
      ) : null}
    </section>
  );
}

"use client";

import type { AttendanceResponse, AuthMeResponse } from "@agu/contracts";
import { StatusBadge } from "@agu/ui";
import { useEffect, useId, useRef, useState } from "react";
import {
  buildCheckInSubmitPath,
  hasCheckInAccess,
  messageForCheckInResponse,
  parseCheckInQrPayload,
  shouldAcceptScan,
  stateAfterSuccessfulCheckIn,
  stopQrScannerSafely,
  viewForCheckInState,
  type CheckInState
} from "../check-in";

type Html5QrcodeInstance = {
  start: (
    cameraConfig: unknown,
    scannerConfig: unknown,
    onScanSuccess: (decodedText: string) => void,
    onScanFailure?: () => void
  ) => Promise<void | null>;
  stop: () => Promise<void | null>;
  clear: () => void;
};

type CheckInPanelProps = {
  apiBaseUrl: string;
};

export function CheckInPanel({ apiBaseUrl }: CheckInPanelProps) {
  const qrElementId = useId().replaceAll(":", "-");
  const [state, setState] = useState<CheckInState>({ kind: "checking-session" });
  const [manualPayload, setManualPayload] = useState("");
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const submittingRef = useRef(false);
  const stateRef = useRef<CheckInState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

        if (response.status === 401) {
          setState({ kind: "anonymous" });
          return;
        }

        if (!response.ok) {
          setState({
            kind: "error",
            message: "Oturum durumu şu anda kontrol edilemiyor.",
            manualOpen: false
          });
          return;
        }

        const me = (await response.json()) as AuthMeResponse;
        setState(
          hasCheckInAccess(me.user)
            ? { kind: "ready", cameraActive: false, manualOpen: false, message: null }
            : { kind: "forbidden" }
        );
      } catch {
        if (active) {
          setState({
            kind: "error",
            message: "API bağlantısı kurulamadığı için oturum durumu alınamıyor.",
            manualOpen: true
          });
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
      void stopCamera();
    };
  }, [apiBaseUrl]);

  async function stopCamera() {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (!scanner) {
      return;
    }

    await stopQrScannerSafely(scanner);
  }

  async function startCamera() {
    if (submittingRef.current) {
      return;
    }

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(qrElementId) as Html5QrcodeInstance;
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: { ideal: "environment" } },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          void handlePayload(decodedText);
        }
      );

      setState({ kind: "ready", cameraActive: true, manualOpen: false, message: null });
    } catch {
      await stopCamera();
      setState({
        kind: "camera-error",
        message: "Kamera başlatılamadı. İzinleri kontrol edin veya manuel girişi kullanın.",
        manualOpen: true
      });
    }
  }

  async function handlePayload(rawPayload: string) {
    if (submittingRef.current || !shouldAcceptScan(stateRef.current)) {
      return;
    }

    const parsed = parseCheckInQrPayload(rawPayload);
    if (!parsed.ok) {
      setManualPayload("");
      setState({ kind: "error", message: parsed.message, manualOpen: true });
      return;
    }

    submittingRef.current = true;
    setManualPayload("");
    setState({ kind: "submitting" });

    try {
      const response = await fetch(`${apiBaseUrl}${buildCheckInSubmitPath(parsed.eventId)}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ token: parsed.token })
      });

      await stopCamera();

      if (response.status === 201) {
        const attendance = (await response.json()) as AttendanceResponse;
        setState(stateAfterSuccessfulCheckIn(attendance));
        return;
      }

      setState({
        kind: "error",
        message: messageForCheckInResponse(response.status),
        manualOpen: true
      });
    } catch {
      await stopCamera();
      setState({
        kind: "error",
        message: messageForCheckInResponse(0),
        manualOpen: true
      });
    } finally {
      submittingRef.current = false;
    }
  }

  function toggleManual() {
    setState((current) => {
      if (current.kind === "ready") {
        return { ...current, manualOpen: !current.manualOpen };
      }

      if (current.kind === "camera-error" || current.kind === "error") {
        return { ...current, manualOpen: !current.manualOpen };
      }

      return current;
    });
  }

  async function submitManual() {
    const payload = manualPayload;
    await handlePayload(payload);
  }

  const view = viewForCheckInState(state);

  return (
    <section className="check-in-panel" aria-labelledby="check-in-panel-heading">
      <div className="section-heading">
        <div>
          <h2 id="check-in-panel-heading">Tarama alanı</h2>
          <p>Kamerayı yalnızca hazır olduğunuzda başlatın veya QR içeriğini manuel girin.</p>
        </div>
        <StatusBadge tone={view.tone}>{view.message}</StatusBadge>
      </div>

      <div className="check-in-status" aria-live="polite">
        <p>{view.message}</p>
        {view.successCheckedInAtLabel ? (
          <p>
            Yoklama zamanı: <time>{view.successCheckedInAtLabel}</time>
          </p>
        ) : null}
      </div>

      <div className="camera-shell">
        <p id="camera-help">
          Kamera önizlemesi QR kodunu okuyabilmek için kullanılır; token metni ekranda gösterilmez.
        </p>
        <div id={qrElementId} className="camera-preview" aria-describedby="camera-help" />
      </div>

      <div className="check-in-actions">
        {view.canStartCamera ? (
          <button type="button" onClick={startCamera} disabled={view.isSubmitting}>
            Kamerayı Başlat
          </button>
        ) : null}
        {view.canStopCamera ? (
          <button
            type="button"
            onClick={() => {
              void stopCamera();
              setState({ kind: "ready", cameraActive: false, manualOpen: false, message: null });
            }}
          >
            Kamerayı Durdur
          </button>
        ) : null}
        {view.canSubmitManual ? (
          <button type="button" className="secondary-action" onClick={toggleManual}>
            Manuel giriş
          </button>
        ) : null}
      </div>

      {view.manualOpen ? (
        <div className="manual-check-in">
          <label>
            <span>QR payload JSON</span>
            <textarea
              value={manualPayload}
              onChange={(event) => setManualPayload(event.target.value)}
              rows={5}
              placeholder='{"version":1,"eventId":"...","token":"..."}'
            />
          </label>
          <button type="button" onClick={submitManual} disabled={view.isSubmitting}>
            Yoklamayı Gönder
          </button>
        </div>
      ) : null}
    </section>
  );
}

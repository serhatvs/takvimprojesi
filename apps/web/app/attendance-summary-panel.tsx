"use client";

import type { AuthMeResponse, EventAttendanceSummaryResponse } from "@agu/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  attendanceSummaryRequestOptions,
  buildAttendanceSummaryPath,
  messageForAttendanceSummaryError,
  shouldApplyAttendanceSummaryResponse,
  shouldRequestAttendanceSummary,
  viewForAttendanceSummaryState,
  type AttendanceSummaryState
} from "./attendance-summary";

type AttendanceSummaryPanelProps = {
  apiBaseUrl: string;
  eventId: string;
  clubId: string;
};

export function AttendanceSummaryPanel({ apiBaseUrl, eventId, clubId }: AttendanceSummaryPanelProps) {
  const [state, setState] = useState<AttendanceSummaryState>({ kind: "checking-session" });
  const mountedRef = useRef(false);
  const loadingRef = useRef(false);

  const loadSummary = useCallback(async (mode: "initial" | "refresh") => {
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setState((current) => {
      if (mode === "refresh" && (current.kind === "ready" || current.kind === "refreshing")) {
        return {
          kind: "refreshing",
          summary: current.summary,
          loadedAt: current.loadedAt
        };
      }

      return { kind: "loading" };
    });

    try {
      const response = await fetch(
        `${apiBaseUrl}${buildAttendanceSummaryPath(eventId)}`,
        attendanceSummaryRequestOptions()
      );

      if (!shouldApplyAttendanceSummaryResponse(mountedRef.current)) {
        return;
      }

      if (!response.ok) {
        setState({ kind: "error", message: messageForAttendanceSummaryError(response.status) });
        return;
      }

      const summary = (await response.json()) as EventAttendanceSummaryResponse;
      setState({
        kind: "ready",
        summary,
        loadedAt: new Date().toISOString()
      });
    } catch {
      if (shouldApplyAttendanceSummaryResponse(mountedRef.current)) {
        setState({ kind: "error", message: messageForAttendanceSummaryError(0) });
      }
    } finally {
      loadingRef.current = false;
    }
  }, [apiBaseUrl, eventId]);

  useEffect(() => {
    mountedRef.current = true;
    loadingRef.current = false;

    async function loadAccess() {
      setState({ kind: "checking-session" });

      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, attendanceSummaryRequestOptions());

        if (!shouldApplyAttendanceSummaryResponse(mountedRef.current)) {
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
        if (!shouldRequestAttendanceSummary(me.user, clubId)) {
          setState({ kind: "hidden" });
          return;
        }

        await loadSummary("initial");
      } catch {
        if (shouldApplyAttendanceSummaryResponse(mountedRef.current)) {
          setState({ kind: "hidden" });
        }
      }
    }

    void loadAccess();

    return () => {
      mountedRef.current = false;
      loadingRef.current = false;
    };
  }, [apiBaseUrl, clubId, eventId, loadSummary]);

  const view = viewForAttendanceSummaryState(state);

  if (!view.visible) {
    return null;
  }

  return (
    <section className="attendance-summary-panel" aria-labelledby="attendance-summary-heading">
      <div className="attendance-summary-heading">
        <div>
          <h2 id="attendance-summary-heading">Katılım Özeti</h2>
          <p>Kayıt ve yoklama toplamları yalnızca yetkili yöneticilere gösterilir.</p>
        </div>
        {view.canRefresh ? (
          <button
            type="button"
            onClick={() => void loadSummary("refresh")}
            disabled={view.refreshDisabled}
          >
            Verileri Yenile
          </button>
        ) : null}
      </div>

      {view.message ? (
        <p className="attendance-summary-status" aria-live="polite">
          {view.message}
        </p>
      ) : null}

      {view.metrics.length > 0 ? (
        <>
          <dl className="attendance-summary-metrics">
            {view.metrics.map((metric) => (
              <div key={metric.label}>
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>

          {view.rateLabel ? (
            <div className="attendance-summary-progress" aria-label={`Katılım oranı ${view.rateLabel}`}>
              <div>
                <span style={{ width: `${view.progressValue}%` }} />
              </div>
              <p>{view.rateLabel} katılım oranı</p>
            </div>
          ) : null}

          {view.updatedAtLabel ? (
            <p className="attendance-summary-updated">
              Son güncelleme: <time>{view.updatedAtLabel}</time>
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

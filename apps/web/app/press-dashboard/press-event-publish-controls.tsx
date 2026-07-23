"use client";

import { useRef, useState } from "react";
import {
  buildPublishApiPath,
  getSafePublishErrorMessage
} from "./press-dashboard-helper";

type PressEventPublishControlsProps = {
  eventId: string;
  eventTitle: string;
  clubName: string;
  startsAt: string;
  onPublishSuccess: () => void;
};

export function PressEventPublishControls({
  eventId,
  eventTitle,
  clubName,
  startsAt,
  onPublishSuccess
}: PressEventPublishControlsProps) {
  const submittingRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function openPanel() {
    if (submittingRef.current) return;
    setError("");
    setIsOpen(true);
  }

  function closePanel() {
    if (submittingRef.current) return;
    setError("");
    setIsOpen(false);
  }

  async function submitPublish() {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setError("");

    try {
      const url = buildPublishApiPath(eventId);
      const reqInit: RequestInit = {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      };

      const response = await fetch(url, reqInit);

      if (response.ok) {
        setIsOpen(false);
        setSuccessMessage("Etkinlik yayınlandı.");
        onPublishSuccess();
        return;
      }

      setError(getSafePublishErrorMessage(response.status));
    } catch {
      setError("Etkinlik yayınlanamadı. Lütfen tekrar deneyin.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="press-publish-controls" style={{ marginTop: "var(--spacing-3)" }}>
      {successMessage && (
        <div className="notice-panel" data-tone="success" role="status" aria-live="polite">
          <p>{successMessage}</p>
        </div>
      )}

      {!isOpen && !successMessage && (
        <div className="publish-action-button">
          <button
            type="button"
            className="primary-action"
            onClick={openPanel}
          >
            Yayınla
          </button>
        </div>
      )}

      {isOpen && (
        <div className="inline-confirmation-panel" role="region" aria-label="Yayınlama Paneli">
          <p className="confirmation-text" style={{ marginBottom: "var(--spacing-2)" }}>
            <strong>{clubName}</strong> - <strong>{eventTitle}</strong> (Tarih: {startsAt})
          </p>
          <p className="confirmation-subtext" style={{ marginBottom: "var(--spacing-2)" }}>
            Bu etkinliği herkesin erişimine açarak yayınlamak istediğinizden emin misiniz?
          </p>
          {error && (
            <div className="notice-panel" data-tone="critical" role="alert" style={{ marginBottom: "var(--spacing-2)" }}>
              <p>{error}</p>
            </div>
          )}
          <div className="confirmation-actions" style={{ display: "flex", gap: "var(--spacing-2)" }}>
            <button
              type="button"
              className="primary-action"
              onClick={submitPublish}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Yayınlanıyor..." : "Yayınla"}
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={closePanel}
              disabled={isSubmitting}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  buildSubmitEventApiPath,
  canSubmitDraftEvent,
  getSafeSubmitErrorMessage
} from "./submit-event-helper";

type SubmitEventControlProps = {
  eventId: string;
  eventTitle: string;
  status: string;
};

export function SubmitEventControl({ eventId, eventTitle, status }: SubmitEventControlProps) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!canSubmitDraftEvent(status)) {
    return null;
  }

  function openConfirmation() {
    setError("");
    setShowConfirm(true);
  }

  function cancelConfirmation() {
    if (submittingRef.current) return;
    setError("");
    setShowConfirm(false);
  }

  async function handleConfirmSubmit() {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(buildSubmitEventApiPath(eventId), {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      });

      if (response.ok) {
        setShowConfirm(false);
        setSuccessMessage("Etkinlik incelemeye gönderildi.");
        router.refresh();
        return;
      }

      setError(getSafeSubmitErrorMessage(response.status));
    } catch {
      setError("Etkinlik incelemeye gönderilemedi. Lütfen tekrar deneyin.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="submit-event-control">
      {successMessage && (
        <div className="notice-panel" data-tone="success" role="status" aria-live="polite">
          <p>{successMessage}</p>
        </div>
      )}

      {showConfirm ? (
        <div className="submit-confirmation-panel" role="region" aria-label="Onay Paneli">
          <p className="confirmation-text">
            <strong>{eventTitle}</strong> başlıklı taslak etkinliği Basın Yayın incelemesine göndermek istediğinizden emin misiniz?
          </p>
          {error && (
            <div className="notice-panel" data-tone="critical" role="alert">
              <p>{error}</p>
            </div>
          )}
          <div className="confirmation-actions" style={{ display: "flex", gap: "var(--spacing-2)", marginTop: "var(--spacing-2)" }}>
            <button
              type="button"
              className="primary-action"
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Gönderiliyor..." : "Onaya Gönder"}
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={cancelConfirmation}
              disabled={isSubmitting}
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : (
        !successMessage && (
          <button
            type="button"
            className="primary-action"
            onClick={openConfirmation}
          >
            Onaya Gönder
          </button>
        )
      )}
    </div>
  );
}

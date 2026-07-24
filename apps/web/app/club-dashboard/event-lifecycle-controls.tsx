"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  buildCancelEventApiPath,
  buildCompleteEventApiPath,
  canCancelEvent,
  canCompleteEvent,
  getSafeCancelErrorMessage,
  getSafeCompleteErrorMessage,
  validateCancelReason
} from "./event-lifecycle-helper";
import { statusLabelFor } from "./club-dashboard";

type EventLifecycleControlsProps = {
  eventId: string;
  eventTitle: string;
  status: string;
  endsAt: string;
  formattedEndsAt: string;
  clubName: string;
};

export function EventLifecycleControls({
  eventId,
  eventTitle,
  status,
  endsAt,
  formattedEndsAt,
  clubName
}: EventLifecycleControlsProps) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [activePanel, setActivePanel] = useState<"none" | "cancel" | "complete">("none");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reasonValidationError, setReasonValidationError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const showCancelAction = canCancelEvent(status);
  const showCompleteAction = canCompleteEvent(status, endsAt);

  if (!showCancelAction && !showCompleteAction) {
    return successMessage ? (
      <div className="notice-panel" data-tone="success" role="status" aria-live="polite">
        <p>{successMessage}</p>
      </div>
    ) : null;
  }

  function openCancel() {
    if (submittingRef.current) return;
    setError("");
    setReasonValidationError("");
    setActivePanel("cancel");
  }

  function openComplete() {
    if (submittingRef.current) return;
    setError("");
    setReasonValidationError("");
    setActivePanel("complete");
  }

  function handleCancelClick() {
    if (activePanel === "cancel") {
      closePanel();
    } else {
      openCancel();
    }
  }

  function handleCompleteClick() {
    if (activePanel === "complete") {
      closePanel();
    } else {
      openComplete();
    }
  }

  function closePanel() {
    if (submittingRef.current) return;
    setError("");
    setReasonValidationError("");
    setActivePanel("none");
  }

  async function handleConfirmCancel() {
    if (submittingRef.current) return;

    const validationMsg = validateCancelReason(reason);
    if (validationMsg) {
      setReasonValidationError(validationMsg);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError("");
    setReasonValidationError("");

    try {
      const response = await fetch(buildCancelEventApiPath(eventId), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() })
      });

      if (response.ok) {
        setActivePanel("none");
        setReason("");
        setSuccessMessage("Etkinlik iptal edildi.");
        router.refresh();
        return;
      }

      setError(getSafeCancelErrorMessage(response.status));
    } catch {
      setError("Etkinlik iptal edilemedi. Lütfen tekrar deneyin.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleConfirmComplete() {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(buildCompleteEventApiPath(eventId), {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      });

      if (response.ok) {
        setActivePanel("none");
        setSuccessMessage("Etkinlik tamamlandı.");
        router.refresh();
        return;
      }

      setError(getSafeCompleteErrorMessage(response.status));
    } catch {
      setError("Etkinlik tamamlanamadı. Lütfen tekrar deneyin.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="event-lifecycle-controls" style={{ marginTop: "var(--spacing-3)" }}>
      {successMessage && (
        <div className="notice-panel" data-tone="success" role="status" aria-live="polite" style={{ marginBottom: "var(--spacing-2)" }}>
          <p>{successMessage}</p>
        </div>
      )}

      {activePanel === "cancel" && (
        <div className="cancel-confirmation-panel" role="region" aria-label="İptal Onay Paneli" style={{ padding: "var(--spacing-3)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-2)" }}>
          <p className="confirmation-title" style={{ fontWeight: 600, marginBottom: "var(--spacing-1)" }}>
            {eventTitle}
          </p>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)", marginBottom: "var(--spacing-2)" }}>
            Mevcut Durum: {statusLabelFor(status)}
          </p>
          <p className="confirmation-text" style={{ marginBottom: "var(--spacing-2)" }}>
            Bu etkinliği iptal etmek istediğinizden emin misiniz?
          </p>
          <div className="form-group" style={{ marginBottom: "var(--spacing-2)" }}>
            <label htmlFor={`cancel-reason-${eventId}`} style={{ display: "block", marginBottom: "var(--spacing-1)", fontWeight: 500 }}>
              İptal Gerekçesi
            </label>
            <textarea
              id={`cancel-reason-${eventId}`}
              name="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="İptal gerekçesini yazınız (en az 5 karakter)..."
              disabled={isSubmitting}
              className="filter-input"
              style={{ width: "100%", resize: "vertical" }}
            />
            {reasonValidationError && (
              <p className="validation-error" style={{ color: "var(--tone-critical)", fontSize: "var(--font-size-sm)", marginTop: "var(--spacing-1)" }}>
                {reasonValidationError}
              </p>
            )}
          </div>
          {error && (
            <div className="notice-panel" data-tone="critical" role="alert" style={{ marginBottom: "var(--spacing-2)" }}>
              <p>{error}</p>
            </div>
          )}
          <div className="confirmation-actions" style={{ display: "flex", gap: "var(--spacing-2)" }}>
            <button
              type="button"
              className="secondary-action"
              onClick={handleConfirmCancel}
              disabled={isSubmitting}
              style={{ backgroundColor: "var(--tone-critical-bg, #fee2e2)", color: "var(--tone-critical-fg, #991b1b)" }}
            >
              {isSubmitting ? "İptal ediliyor..." : "Etkinliği İptal Et"}
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

      {activePanel === "complete" && (
        <div className="complete-confirmation-panel" role="region" aria-label="Tamamlama Onay Paneli" style={{ padding: "var(--spacing-3)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-2)" }}>
          <p className="confirmation-title" style={{ fontWeight: 600, marginBottom: "var(--spacing-1)" }}>
            {eventTitle}
          </p>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)", marginBottom: "var(--spacing-1)" }}>
            Kulüp: {clubName}
          </p>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)", marginBottom: "var(--spacing-2)" }}>
            Bitiş Zamanı: {formattedEndsAt}
          </p>
          <p className="confirmation-text" style={{ marginBottom: "var(--spacing-2)" }}>
            Bu etkinliği tamamlandı olarak işaretlemek istediğinizden emin misiniz?
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
              onClick={handleConfirmComplete}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Tamamlanıyor..." : "Etkinliği Tamamla"}
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

      {activePanel === "none" && !successMessage && (
        <div className="action-buttons-group" style={{ display: "flex", gap: "var(--spacing-2)" }}>
          {showCancelAction && (
            <button
              type="button"
              className="secondary-action"
              onClick={handleCancelClick}
              disabled={isSubmitting}
            >
              Etkinliği İptal Et
            </button>
          )}
          {showCompleteAction && (
            <button
              type="button"
              className="primary-action"
              onClick={handleCompleteClick}
              disabled={isSubmitting}
            >
              Etkinliği Tamamla
            </button>
          )}
        </div>
      )}
    </div>
  );
}

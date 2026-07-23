"use client";

import { useRef, useState } from "react";
import {
  buildReviewApiPath,
  getSafeReviewErrorMessage
} from "./press-dashboard-helper";

type ActivePanel = "none" | "approve" | "request-changes" | "reject";

type PressEventReviewControlsProps = {
  eventId: string;
  eventTitle: string;
  clubName: string;
  onReviewSuccess: () => void;
};

export function PressEventReviewControls({
  eventId,
  eventTitle,
  clubName,
  onReviewSuccess
}: PressEventReviewControlsProps) {
  const submittingRef = useRef(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function openPanel(panel: ActivePanel) {
    if (submittingRef.current) return;
    setError("");
    setActivePanel(panel);
  }

  function closePanel() {
    if (submittingRef.current) return;
    setError("");
    setActivePanel("none");
  }

  async function submitReview(action: "approve" | "request-changes" | "reject") {
    if (submittingRef.current) return;

    if (action === "request-changes" || action === "reject") {
      if (!comment.trim()) {
        setError(
          action === "request-changes"
            ? "Lütfen değişiklik gerekçesini girin."
            : "Lütfen ret gerekçesini girin."
        );
        return;
      }
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError("");

    try {
      const url = buildReviewApiPath(eventId, action);
      const reqInit: RequestInit = {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      };

      if (action === "request-changes" || action === "reject" || comment.trim()) {
        reqInit.headers = { "Content-Type": "application/json" };
        reqInit.body = JSON.stringify({ comment: comment.trim() });
      }

      const response = await fetch(url, reqInit);

      if (response.ok) {
        setActivePanel("none");
        setComment("");
        let msg = "İnceleme işlemi tamamlandı.";
        if (action === "approve") msg = "Etkinlik onaylandı.";
        if (action === "request-changes") msg = "Etkinlik için değişiklik istendi.";
        if (action === "reject") msg = "Etkinlik reddedildi.";

        setSuccessMessage(msg);
        onReviewSuccess();
        return;
      }

      setError(getSafeReviewErrorMessage(response.status));
    } catch {
      setError("İnceleme işlemi tamamlanamadı. Lütfen tekrar deneyin.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="press-review-controls" style={{ marginTop: "var(--spacing-3)" }}>
      {successMessage && (
        <div className="notice-panel" data-tone="success" role="status" aria-live="polite">
          <p>{successMessage}</p>
        </div>
      )}

      {activePanel === "none" && !successMessage && (
        <div className="review-action-buttons" style={{ display: "flex", gap: "var(--spacing-2)" }}>
          <button
            type="button"
            className="primary-action"
            onClick={() => openPanel("approve")}
          >
            Onayla
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => openPanel("request-changes")}
          >
            Değişiklik İste
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => openPanel("reject")}
            style={{ color: "var(--color-critical-text, #c53030)" }}
          >
            Reddet
          </button>
        </div>
      )}

      {activePanel === "approve" && (
        <div className="inline-confirmation-panel" role="region" aria-label="Onaylama Paneli">
          <p className="confirmation-text">
            <strong>{clubName}</strong> - <strong>{eventTitle}</strong> başlıklı etkinliği onaylamak istediğinizden emin misiniz?
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
              onClick={() => submitReview("approve")}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Onaylanıyor..." : "Onayla"}
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

      {activePanel === "request-changes" && (
        <div className="inline-confirmation-panel" role="region" aria-label="Değişiklik İsteme Paneli">
          <p className="confirmation-text">
            <strong>{clubName}</strong> - <strong>{eventTitle}</strong> için değişiklik isteyin.
          </p>
          {error && (
            <div className="notice-panel" data-tone="critical" role="alert">
              <p>{error}</p>
            </div>
          )}
          <div className="form-group" style={{ marginTop: "var(--spacing-2)" }}>
            <label htmlFor={`request-changes-comment-${eventId}`}>Değişiklik Gerekçesi / Yorum</label>
            <textarea
              id={`request-changes-comment-${eventId}`}
              name="comment"
              className="form-input"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Kulübe iletilecek açıklamanı yazın"
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="confirmation-actions" style={{ display: "flex", gap: "var(--spacing-2)", marginTop: "var(--spacing-2)" }}>
            <button
              type="button"
              className="primary-action"
              onClick={() => submitReview("request-changes")}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Gönderiliyor..." : "Değişiklik İste"}
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

      {activePanel === "reject" && (
        <div className="inline-confirmation-panel" role="region" aria-label="Reddetme Paneli">
          <p className="confirmation-text">
            <strong>{clubName}</strong> - <strong>{eventTitle}</strong> etkinliğini reddedin.
          </p>
          {error && (
            <div className="notice-panel" data-tone="critical" role="alert">
              <p>{error}</p>
            </div>
          )}
          <div className="form-group" style={{ marginTop: "var(--spacing-2)" }}>
            <label htmlFor={`reject-comment-${eventId}`}>Ret Gerekçesi</label>
            <textarea
              id={`reject-comment-${eventId}`}
              name="comment"
              className="form-input"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ret gerekçesini yazın"
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="confirmation-actions" style={{ display: "flex", gap: "var(--spacing-2)", marginTop: "var(--spacing-2)" }}>
            <button
              type="button"
              className="primary-action"
              onClick={() => submitReview("reject")}
              disabled={isSubmitting}
              style={{ backgroundColor: "var(--color-critical-text, #c53030)", borderColor: "var(--color-critical-text, #c53030)" }}
            >
              {isSubmitting ? "Reddediliyor..." : "Reddet"}
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

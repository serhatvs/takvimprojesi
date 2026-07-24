"use client";

import type { EventRevisionResponse } from "@agu/contracts";
import { StatusBadge } from "@agu/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatEventDateTime } from "../../../../public-events";
import {
  parseLocalToIstanbulUtc,
  parseUtcToIstanbulLocal,
  validateCapacity
} from "../../new/create-event-helper";
import {
  buildReturnDashboardHref,
  buildRevisionApiPath,
  buildSubmitApiPath,
  getSafeRevisionUpdateErrorMessage
} from "./edit-event-helper";

type EditEventFormProps = {
  eventId: string;
  initialRevision: EventRevisionResponse;
  returnParams: {
    clubId: string;
    status?: string;
    q?: string;
    page?: string;
    pageSize?: string;
  };
};

export function EditEventForm({ eventId, initialRevision, returnParams }: EditEventFormProps) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const { event, latestChangeRequest } = initialRevision;

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [startsAt, setStartsAt] = useState(() => parseUtcToIstanbulLocal(event.startsAt));
  const [endsAt, setEndsAt] = useState(() => parseUtcToIstanbulLocal(event.endsAt));
  const [location, setLocation] = useState(event.location);
  const [capacity, setCapacity] = useState(() => (event.capacity !== null && event.capacity !== undefined ? event.capacity.toString() : ""));
  const [participationScope, setParticipationScope] = useState<"AGU_ONLY" | "EXTERNAL_ALLOWED">(event.participationScope ?? "AGU_ONLY");

  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  function validateClientForm(): boolean {
    setError("");

    if (!title || !title.trim()) {
      setError("Etkinlik başlığı zorunludur.");
      return false;
    }
    if (!description || !description.trim()) {
      setError("Etkinlik açıklaması zorunludur.");
      return false;
    }
    if (!location || !location.trim()) {
      setError("Etkinlik konumu zorunludur.");
      return false;
    }
    if (!startsAt) {
      setError("Başlangıç tarihi ve saati zorunludur.");
      return false;
    }
    if (!endsAt) {
      setError("Bitiş tarihi ve saati zorunludur.");
      return false;
    }

    const startUtc = parseLocalToIstanbulUtc(startsAt);
    const endUtc = parseLocalToIstanbulUtc(endsAt);

    if (!startUtc || !endUtc) {
      setError("Lütfen geçerli başlangıç ve bitiş tarihleri seçin.");
      return false;
    }

    if (new Date(startUtc) >= new Date(endUtc)) {
      setError("Başlangıç zamanı bitiş zamanından önce olmalıdır.");
      return false;
    }

    const capValidation = validateCapacity(capacity);
    if (!capValidation.valid) {
      setError(capValidation.error || "Girdiğiniz kapasite geçersiz.");
      return false;
    }

    return true;
  }

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;

    if (validateClientForm()) {
      setIsConfirmationOpen(true);
    }
  }

  function handleCancelConfirmation() {
    if (submittingRef.current) return;
    setError("");
    setIsConfirmationOpen(false);
  }

  async function executeSaveAndResubmit() {
    if (submittingRef.current) return;

    if (!validateClientForm()) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError("");

    const capValidation = validateCapacity(capacity);
    const capacityVal = capValidation.value !== undefined ? capValidation.value : null;

    const payload = {
      title: title.trim(),
      description: description.trim(),
      startsAt: parseLocalToIstanbulUtc(startsAt),
      endsAt: parseLocalToIstanbulUtc(endsAt),
      location: location.trim(),
      capacity: capacityVal,
      participationScope
    };

    try {
      // Step 1: PATCH revision
      const patchUrl = buildRevisionApiPath(eventId);
      const patchRes = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(payload)
      });

      if (!patchRes.ok) {
        setError(getSafeRevisionUpdateErrorMessage(patchRes.status));
        submittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      // Step 2: POST submit
      const submitUrl = buildSubmitApiPath(eventId);
      const submitRes = await fetch(submitUrl, {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      });

      if (!submitRes.ok) {
        setError("Değişiklikler kaydedildi ancak etkinlik yeniden incelemeye gönderilemedi. Tekrar deneyin.");
        submittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      // Success
      setIsConfirmationOpen(false);
      const targetHref = buildReturnDashboardHref(returnParams.clubId, returnParams, "resubmitted");
      router.push(targetHref);
    } catch {
      setError("Etkinlik değişiklikleri kaydedilemedi. Lütfen tekrar deneyin.");
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const returnHref = buildReturnDashboardHref(returnParams.clubId, returnParams);

  return (
    <main className="page-shell">
      <header className="intro">
        <p className="eyebrow">Kulüp Yönetimi</p>
        <h1>Etkinliği Düzenle</h1>
        <p className="subhead">Kulüp: <strong>{event.club.name}</strong></p>
        <div className="dashboard-nav" style={{ marginTop: "var(--spacing-2)" }}>
          <Link href={returnHref} className="secondary-action">
            Kulüp Paneline Dön
          </Link>
        </div>
      </header>

      <section className="revision-notice-section" style={{ marginBottom: "var(--spacing-4)" }}>
        <div className="notice-panel" data-tone="warning" role="region" aria-label="Basın Yayın Değişiklik İsteği">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-2)" }}>
            <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Basın Yayın Değişiklik İsteği</h2>
            <StatusBadge tone="neutral">Değişiklik İstendi</StatusBadge>
          </div>
          <p className="change-request-comment" style={{ fontWeight: 500, fontSize: "1rem" }}>
            {latestChangeRequest ? latestChangeRequest.comment : "Bu etkinlik için değişiklik açıklaması bulunamadı."}
          </p>
          {latestChangeRequest && (
            <p className="change-request-date" style={{ fontSize: "0.875rem", opacity: 0.8, marginTop: "var(--spacing-1)" }}>
              Tarih: {formatEventDateTime(latestChangeRequest.createdAt)}
            </p>
          )}
        </div>
      </section>

      <section className="form-panel">
        <form onSubmit={handleFormSubmit} noValidate>
          {error && !isConfirmationOpen && (
            <div className="notice-panel" data-tone="critical" role="alert" style={{ marginBottom: "var(--spacing-3)" }}>
              <p>{error}</p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="title">Etkinlik Başlığı</label>
            <input
              type="text"
              id="title"
              name="title"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Açıklama</label>
            <textarea
              id="description"
              name="description"
              className="form-input"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-3)" }}>
            <div className="form-group">
              <label htmlFor="startsAt">Başlangıç Zamanı</label>
              <input
                type="datetime-local"
                id="startsAt"
                name="startsAt"
                className="form-input"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="endsAt">Bitiş Zamanı</label>
              <input
                type="datetime-local"
                id="endsAt"
                name="endsAt"
                className="form-input"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="location">Konum</label>
            <input
              type="text"
              id="location"
              name="location"
              className="form-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="participationScope">Katılım Kapsamı</label>
            <select
              id="participationScope"
              name="participationScope"
              className="form-input"
              value={participationScope}
              onChange={(e) => setParticipationScope(e.target.value as "AGU_ONLY" | "EXTERNAL_ALLOWED")}
              disabled={isSubmitting}
              required
            >
              <option value="AGU_ONLY">AGÜ Katılımcılarına Özel (AGU_ONLY)</option>
              <option value="EXTERNAL_ALLOWED">Dış Katılıma Açık (EXTERNAL_ALLOWED)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="capacity">Kapasite (İsteğe Bağlı)</label>
            <input
              type="number"
              id="capacity"
              name="capacity"
              className="form-input"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              disabled={isSubmitting}
              placeholder="Sınırsız ise boş bırakın"
            />
          </div>

          {!isConfirmationOpen && (
            <div className="form-actions" style={{ display: "flex", gap: "var(--spacing-3)", marginTop: "var(--spacing-4)" }}>
              <button
                type="submit"
                className="primary-action"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Kaydediliyor ve gönderiliyor..." : "Değişiklikleri Kaydet ve Yeniden Onaya Gönder"}
              </button>
              <Link href={returnHref} className="secondary-action">
                Kulüp Paneline Dön
              </Link>
            </div>
          )}

          {isConfirmationOpen && (
            <div className="inline-confirmation-panel" role="region" aria-label="Onay Paneli" style={{ marginTop: "var(--spacing-4)", padding: "var(--spacing-3)", border: "1px solid var(--color-border, #e2e8f0)", borderRadius: "var(--radius-medium, 8px)" }}>
              <p className="confirmation-text" style={{ marginBottom: "var(--spacing-2)" }}>
                <strong>{title}</strong>
              </p>
              <p className="confirmation-subtext" style={{ marginBottom: "var(--spacing-2)" }}>
                Değişiklikleri kaydedip etkinliği yeniden Basın Yayın incelemesine göndermek istediğinizden emin misiniz?
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
                  onClick={executeSaveAndResubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Kaydediliyor ve gönderiliyor..." : "Kaydet ve Yeniden Gönder"}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={handleCancelConfirmation}
                  disabled={isSubmitting}
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}

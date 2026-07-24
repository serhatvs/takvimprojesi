"use client";

import type { ManageableClub } from "@agu/contracts";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  getSafeErrorMessage,
  parseLocalToIstanbulUtc,
  validateCapacity
} from "./create-event-helper";

type CreateEventFormProps = {
  clubs: ManageableClub[];
  initialClubId: string;
  apiBaseUrl: string;
};

export function CreateEventForm({ clubs, initialClubId, apiBaseUrl }: CreateEventFormProps) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form field state to preserve inputs on error
  const [selectedClubId, setSelectedClubId] = useState(initialClubId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [endsAtLocal, setEndsAtLocal] = useState("");
  const [capacityRaw, setCapacityRaw] = useState("");
  const [participationScope, setParticipationScope] = useState<"AGU_ONLY" | "EXTERNAL_ALLOWED">("AGU_ONLY");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;

    setError("");

    if (!title.trim() || !description.trim() || !location.trim() || !startsAtLocal || !endsAtLocal) {
      setError("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }

    const startsAt = parseLocalToIstanbulUtc(startsAtLocal);
    const endsAt = parseLocalToIstanbulUtc(endsAtLocal);

    if (!startsAt || !endsAt) {
      setError("Lütfen geçerli bir başlangıç ve bitiş zamanı girin.");
      return;
    }

    if (new Date(startsAt) >= new Date(endsAt)) {
      setError("Başlangıç zamanı bitiş zamanından önce olmalıdır.");
      return;
    }

    const capResult = validateCapacity(capacityRaw);
    if (!capResult.valid) {
      setError(capResult.error || "Geçersiz kapasite değeri.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const bodyPayload: Record<string, unknown> = {
        clubId: selectedClubId,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        startsAt,
        endsAt,
        participationScope
      };

      if (capResult.value !== undefined) {
        bodyPayload.capacity = capResult.value;
      }

      const response = await fetch(`${apiBaseUrl}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(bodyPayload)
      });

      if (response.ok) {
        router.push(`/club-dashboard?clubId=${selectedClubId}`);
        router.refresh();
        return;
      }

      setError(getSafeErrorMessage(response.status));
    } catch {
      setError("Etkinlik oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      {error && (
        <div className="notice-panel" data-tone="critical" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="clubId">Kulüp</label>
        <select
          id="clubId"
          name="clubId"
          value={selectedClubId}
          onChange={(e) => setSelectedClubId(e.target.value)}
          required
          className="form-input"
        >
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="title">Etkinlik Başlığı</label>
        <input
          type="text"
          id="title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="form-input"
          placeholder="Etkinlik adını girin"
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Açıklama</label>
        <textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="form-input"
          rows={5}
          placeholder="Etkinlik detaylarını girin"
        />
      </div>

      <div className="form-group">
        <label htmlFor="location">Konum</label>
        <input
          type="text"
          id="location"
          name="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          className="form-input"
          placeholder="Örn: Konferans Salonu"
        />
      </div>

      <div className="form-group-row">
        <div className="form-group">
          <label htmlFor="startsAt">Başlangıç Zamanı</label>
          <input
            type="datetime-local"
            id="startsAt"
            name="startsAt"
            value={startsAtLocal}
            onChange={(e) => setStartsAtLocal(e.target.value)}
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="endsAt">Bitiş Zamanı</label>
          <input
            type="datetime-local"
            id="endsAt"
            name="endsAt"
            value={endsAtLocal}
            onChange={(e) => setEndsAtLocal(e.target.value)}
            required
            className="form-input"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="participationScope">Katılım Kapsamı</label>
        <select
          id="participationScope"
          name="participationScope"
          value={participationScope}
          onChange={(e) => setParticipationScope(e.target.value as "AGU_ONLY" | "EXTERNAL_ALLOWED")}
          required
          className="form-input"
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
          value={capacityRaw}
          onChange={(e) => setCapacityRaw(e.target.value)}
          className="form-input"
          min={1}
          placeholder="Örn: 100"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="primary-action" disabled={isSubmitting}>
          {isSubmitting ? "Oluşturuluyor..." : "Taslak Oluştur"}
        </button>
      </div>
    </form>
  );
}

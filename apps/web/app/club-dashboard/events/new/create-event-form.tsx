"use client";

import type { ManageableClub } from "@agu/contracts";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type CreateEventFormProps = {
  clubs: ManageableClub[];
  initialClubId: string;
  apiBaseUrl: string;
};

function parseLocalToIstanbulUtc(localDateTimeString: string): string {
  if (!localDateTimeString) return "";
  // datetime-local input value is in format "YYYY-MM-DDTHH:mm"
  // Appending "+03:00" explicitly sets the timezone to Istanbul time
  const date = new Date(`${localDateTimeString}:00.000+03:00`);
  return date.toISOString();
}

export function CreateEventForm({ clubs, initialClubId, apiBaseUrl }: CreateEventFormProps) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;

    setError("");
    const formData = new FormData(e.currentTarget);

    const clubId = formData.get("clubId") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const location = formData.get("location") as string;
    const startsAtLocal = formData.get("startsAt") as string;
    const endsAtLocal = formData.get("endsAt") as string;
    const capacityRaw = formData.get("capacity") as string;

    if (!title.trim() || !description.trim() || !location.trim() || !startsAtLocal || !endsAtLocal) {
      setError("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }

    const startsAt = parseLocalToIstanbulUtc(startsAtLocal);
    const endsAt = parseLocalToIstanbulUtc(endsAtLocal);
    const capacity = capacityRaw ? parseInt(capacityRaw, 10) : undefined;

    if (new Date(startsAt) >= new Date(endsAt)) {
      setError("Başlangıç zamanı bitiş zamanından önce olmalıdır.");
      return;
    }

    if (capacity !== undefined && (isNaN(capacity) || capacity <= 0)) {
      setError("Kapasite pozitif bir tam sayı olmalıdır.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          clubId,
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          startsAt,
          endsAt,
          capacity
        })
      });

      if (response.ok) {
        // const event = (await response.json()) as DraftEventResponse;
        router.push(`/club-dashboard?clubId=${clubId}`);
        router.refresh();
        return;
      }

      if (response.status === 400) {
        const body = (await response.json()) as { message?: unknown };
        setError(typeof body.message === "string" ? body.message : "Geçersiz form verisi.");
        return;
      }

      if (response.status === 401 || response.status === 403) {
        setError("Bu işlemi gerçekleştirmek için yetkiniz bulunmuyor.");
        return;
      }

      setError("Beklenmeyen bir hata oluştu.");
    } catch {
      setError("API bağlantısı kurulamadı.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      {error && (
        <div className="notice-panel" data-tone="critical">
          <p>{error}</p>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="clubId">Kulüp</label>
        <select id="clubId" name="clubId" defaultValue={initialClubId} required className="form-input">
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="title">Etkinlik Başlığı</label>
        <input type="text" id="title" name="title" required className="form-input" placeholder="Etkinlik adını girin" />
      </div>

      <div className="form-group">
        <label htmlFor="description">Açıklama</label>
        <textarea
          id="description"
          name="description"
          required
          className="form-input"
          rows={5}
          placeholder="Etkinlik detaylarını girin"
        />
      </div>

      <div className="form-group">
        <label htmlFor="location">Konum</label>
        <input type="text" id="location" name="location" required className="form-input" placeholder="Örn: Konferans Salonu" />
      </div>

      <div className="form-group-row">
        <div className="form-group">
          <label htmlFor="startsAt">Başlangıç Zamanı</label>
          <input type="datetime-local" id="startsAt" name="startsAt" required className="form-input" />
        </div>

        <div className="form-group">
          <label htmlFor="endsAt">Bitiş Zamanı</label>
          <input type="datetime-local" id="endsAt" name="endsAt" required className="form-input" />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="capacity">Kapasite (İsteğe Bağlı)</label>
        <input type="number" id="capacity" name="capacity" className="form-input" min={1} placeholder="Örn: 100" />
      </div>

      <div className="form-actions">
        <button type="submit" className="primary-action" disabled={isSubmitting}>
          {isSubmitting ? "Oluşturuluyor..." : "Taslak Oluştur"}
        </button>
      </div>
    </form>
  );
}

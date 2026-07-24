import { getApiBaseUrl } from "@agu/config";
import Link from "next/link";
import { AttendanceQrLiveScreen } from "./attendance-qr-live-screen";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ eventId: string }>;
};

async function loadEventForLiveQr(eventId: string) {
  const apiBaseUrl = getApiBaseUrl();
  try {
    const response = await fetch(`${apiBaseUrl}/events/${encodeURIComponent(eventId)}`, {
      cache: "no-store"
    });

    if (response.status === 404) {
      return { status: "not-found" as const };
    }

    if (!response.ok) {
      return { status: "error" as const, message: "Etkinlik yüklenemedi." };
    }

    const data = await response.json();
    return { status: "success" as const, event: data.event };
  } catch {
    return { status: "error" as const, message: "Sunucu bağlantı hatası." };
  }
}

export default async function OrganizerAttendanceLivePage({ params }: Props) {
  const resolvedParams = await params;
  const eventId = resolvedParams.eventId;
  const result = await loadEventForLiveQr(eventId);
  const apiBaseUrl = getApiBaseUrl();

  if (result.status === "not-found") {
    return (
      <main className="page-shell">
        <div className="notice-panel" data-tone="critical">
          <h2>Etkinlik Bulunamadı</h2>
          <p>İstenen etkinlik bulunamadı veya kaldırılmış.</p>
          <div style={{ marginTop: "var(--spacing-3)" }}>
            <Link href="/club-dashboard" className="secondary-action">
              Kulüp Yönetimine Dön
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (result.status === "error") {
    return (
      <main className="page-shell">
        <div className="notice-panel" data-tone="critical">
          <h2>Hata</h2>
          <p>{result.message}</p>
          <div style={{ marginTop: "var(--spacing-3)" }}>
            <Link href="/club-dashboard" className="secondary-action">
              Kulüp Yönetimine Dön
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { event } = result;

  return (
    <AttendanceQrLiveScreen
      apiBaseUrl={apiBaseUrl}
      eventId={eventId}
      event={{
        id: event.id,
        title: event.title,
        clubId: event.clubId,
        clubName: event.club?.name || "Kulüp",
        status: event.status,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location
      }}
    />
  );
}

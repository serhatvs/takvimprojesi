import type { EventRevisionResponse } from "@agu/contracts";
import Link from "next/link";
import { EditEventForm } from "./edit-event-form";
import {
  buildReturnDashboardHref,
  buildRevisionApiPath,
  getSafeRevisionDetailErrorMessage
} from "./edit-event-helper";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ clubId?: string; status?: string; q?: string; page?: string; pageSize?: string }>;
}) {
  const { eventId } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const clubId = typeof resolvedSearchParams.clubId === "string" ? resolvedSearchParams.clubId : "";

  const returnParams = {
    clubId,
    ...(typeof resolvedSearchParams.status === "string" ? { status: resolvedSearchParams.status } : {}),
    ...(typeof resolvedSearchParams.q === "string" ? { q: resolvedSearchParams.q } : {}),
    ...(typeof resolvedSearchParams.page === "string" ? { page: resolvedSearchParams.page } : {}),
    ...(typeof resolvedSearchParams.pageSize === "string" ? { pageSize: resolvedSearchParams.pageSize } : {})
  };

  const returnHref = buildReturnDashboardHref(clubId, returnParams);

  try {
    const res = await fetch(buildRevisionApiPath(eventId), {
      cache: "no-store",
      credentials: "include"
    });

    if (!res.ok) {
      const errorMessage = getSafeRevisionDetailErrorMessage(res.status);
      return (
        <main className="page-shell">
          <header className="intro">
            <p className="eyebrow">Kulüp Yönetimi</p>
            <h1>Etkinliği Düzenle</h1>
            <div className="dashboard-nav" style={{ marginTop: "var(--spacing-2)" }}>
              <Link href={returnHref} className="secondary-action">
                Kulüp Paneline Dön
              </Link>
            </div>
          </header>
          <div className="notice-panel" data-tone="critical" role="alert">
            <h2>Hata</h2>
            <p>{errorMessage}</p>
          </div>
        </main>
      );
    }

    const initialRevision = (await res.json()) as EventRevisionResponse;

    return (
      <EditEventForm
        eventId={eventId}
        initialRevision={initialRevision}
        returnParams={returnParams}
      />
    );
  } catch {
    return (
      <main className="page-shell">
        <header className="intro">
          <p className="eyebrow">Kulüp Yönetimi</p>
          <h1>Etkinliği Düzenle</h1>
          <div className="dashboard-nav" style={{ marginTop: "var(--spacing-2)" }}>
            <Link href={returnHref} className="secondary-action">
              Kulüp Paneline Dön
            </Link>
          </div>
        </header>
        <div className="notice-panel" data-tone="critical" role="alert">
          <h2>Hata</h2>
          <p>Etkinlik bilgileri alınamadı. Lütfen tekrar deneyin.</p>
        </div>
      </main>
    );
  }
}

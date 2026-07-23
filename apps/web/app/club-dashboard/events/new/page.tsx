import { getApiBaseUrl } from "@agu/config";
import Link from "next/link";
import { loadManageableClubs } from "../../club-dashboard";
import { CreateEventForm } from "./create-event-form";

export const dynamic = "force-dynamic";

export default async function NewEventPage({
  searchParams
}: {
  searchParams?: Promise<{ clubId?: string }>;
}) {
  const resolvedParams = (await searchParams) || {};
  const manageableClubsResult = await loadManageableClubs();

  if (manageableClubsResult.status === "api-error") {
    return (
      <main className="page-shell">
        <div className="notice-panel" data-tone="critical">
          <h2>Hata</h2>
          <p>Yönetilebilir kulüp bilgisi alınamadı. Oturumunuzu kontrol edin.</p>
        </div>
      </main>
    );
  }

  const clubs = manageableClubsResult.clubs;
  if (clubs.length === 0) {
    return (
      <main className="page-shell">
        <header className="intro">
          <p className="eyebrow">Etkinlik Yönetimi</p>
          <h1>Yeni Etkinlik Oluştur</h1>
          <div className="dashboard-nav">
            <Link href="/" className="secondary-action">
              Ana Sayfaya Dön
            </Link>
          </div>
        </header>
        <div className="empty-panel">
          <p>Yönetebileceğiniz kulüp bulunamadı.</p>
        </div>
      </main>
    );
  }

  const foundClub = resolvedParams.clubId ? clubs.find((c) => c.id === resolvedParams.clubId) : undefined;
  const selectedClubId = foundClub ? foundClub.id : clubs[0]!.id;

  return (
    <main className="page-shell">
      <header className="intro">
        <p className="eyebrow">Etkinlik Yönetimi</p>
        <h1>Yeni Etkinlik Oluştur</h1>
        <div className="dashboard-nav">
          <Link href={`/club-dashboard?clubId=${selectedClubId}`} className="secondary-action">
            İptal Et
          </Link>
        </div>
      </header>

      <section className="form-panel">
        <CreateEventForm
          clubs={clubs}
          initialClubId={selectedClubId}
          apiBaseUrl={getApiBaseUrl()}
        />
      </section>
    </main>
  );
}

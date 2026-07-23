import { getApiBaseUrl } from "@agu/config";
import type { HealthResponse } from "@agu/contracts";
import { StatusBadge } from "@agu/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  buildPublicEventDetailHref,
  buildPublicEventsPageHref,
  loadPublicEvents,
  toEventCardViewModel,
  type RawSearchParams
} from "./public-events";

export const dynamic = "force-dynamic";

async function getApiHealth(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/health`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as HealthResponse;
  } catch {
    return null;
  }
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<RawSearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const health = await getApiHealth();
  const publicEvents = await loadPublicEvents(resolvedSearchParams);
  const showDevAuth =
    process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === "true";
  const apiBaseUrl = getApiBaseUrl();
  let devAuthPanel: ReactNode = null;

  if (showDevAuth) {
    const { DevAuthPanel } = await import("./dev-auth-panel");
    devAuthPanel = <DevAuthPanel apiBaseUrl={apiBaseUrl} />;
  }

  return (
    <main className="page-shell">
      <section className="intro">
        <p className="eyebrow">Kampus etkinlikleri</p>
        <h1>AGÜ Kampüs Takvimi</h1>
        <p>
          AGÜ öğrenci kulüplerinin Basın Yayın onayından geçen yaklaşan
          etkinliklerini tek yerden takip edin.
        </p>
      </section>

      <section className="events-panel" aria-labelledby="events-heading">
        <div className="section-heading">
          <div>
            <h2 id="events-heading">Yaklaşan etkinlikler</h2>
            <p>Yalnızca yayınlanmış kampüs etkinlikleri gösterilir.</p>
          </div>
          <StatusBadge tone="success">Public liste</StatusBadge>
        </div>

        <form className="event-filters" action="/" aria-label="Etkinlik filtreleri">
          <label>
            <span>Arama</span>
            <input
              type="search"
              name="q"
              defaultValue={publicEvents.filters.q}
              placeholder="Başlık veya açıklama ara"
            />
          </label>
          <label>
            <span>Başlangıç</span>
            <input type="date" name="from" defaultValue={publicEvents.filters.from} />
          </label>
          <label>
            <span>Bitiş</span>
            <input type="date" name="to" defaultValue={publicEvents.filters.to} />
          </label>
          <div className="filter-actions">
            <button type="submit">Filtrele</button>
            <Link className="secondary-action" href="/">
              Temizle
            </Link>
          </div>
        </form>

        {publicEvents.status === "validation-error" ? (
          <div className="notice-panel" role="alert">
            {publicEvents.message}
          </div>
        ) : null}

        {publicEvents.status === "api-error" ? (
          <div className="notice-panel" role="status">
            {publicEvents.message}
          </div>
        ) : null}

        {publicEvents.status === "success" && publicEvents.data.items.length === 0 ? (
          <div className="empty-panel">
            <h3>Sonuç bulunamadı</h3>
            <p>Filtreleri değiştirerek yayınlanmış farklı etkinlikleri arayabilirsiniz.</p>
          </div>
        ) : null}

        {publicEvents.status === "success" && publicEvents.data.items.length > 0 ? (
          <>
            <div className="event-grid">
              {publicEvents.data.items.map((event) => {
                const card = toEventCardViewModel(event);

                return (
                  <article className="event-card" key={card.id}>
                    <div className="event-card-header">
                      <p>{card.clubName}</p>
                      <StatusBadge tone="success">{card.statusLabel}</StatusBadge>
                    </div>
                    <h3>
                      <Link
                        className="event-card-link"
                        href={buildPublicEventDetailHref(card.id, publicEvents.filters)}
                      >
                        {card.title}
                      </Link>
                    </h3>
                    <dl className="event-meta">
                      <div>
                        <dt>Başlangıç</dt>
                        <dd>{card.startsAt}</dd>
                      </div>
                      <div>
                        <dt>Bitiş</dt>
                        <dd>{card.endsAt}</dd>
                      </div>
                      <div>
                        <dt>Konum</dt>
                        <dd>{card.location}</dd>
                      </div>
                      {card.capacityLabel ? (
                        <div>
                          <dt>Kapasite</dt>
                          <dd>{card.capacityLabel}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <p className="event-description">{card.description}</p>
                  </article>
                );
              })}
            </div>

            <nav className="pagination" aria-label="Etkinlik sayfalama">
              {publicEvents.data.pagination.page > 1 ? (
                <Link
                  href={buildPublicEventsPageHref(
                    publicEvents.filters,
                    publicEvents.data.pagination.page - 1
                  )}
                >
                  Önceki
                </Link>
              ) : (
                <span aria-disabled="true">Önceki</span>
              )}
              <p>
                Sayfa {publicEvents.data.pagination.page} /{" "}
                {Math.max(publicEvents.data.pagination.totalPages, 1)}
              </p>
              {publicEvents.data.pagination.page < publicEvents.data.pagination.totalPages ? (
                <Link
                  href={buildPublicEventsPageHref(
                    publicEvents.filters,
                    publicEvents.data.pagination.page + 1
                  )}
                >
                  Sonraki
                </Link>
              ) : (
                <span aria-disabled="true">Sonraki</span>
              )}
            </nav>
          </>
        ) : null}
      </section>

      <section className="health-panel" aria-label="API health">
        <div>
          <h2>API baglantisi</h2>
          <p>{apiBaseUrl}</p>
        </div>
        {health ? (
          <StatusBadge tone="success">
            {health.service} {health.status} - {health.timeZone}
          </StatusBadge>
        ) : (
          <StatusBadge tone="warning">API health endpointine erisilemiyor</StatusBadge>
        )}
      </section>

      {devAuthPanel ? <div className="developer-section">{devAuthPanel}</div> : null}
    </main>
  );
}

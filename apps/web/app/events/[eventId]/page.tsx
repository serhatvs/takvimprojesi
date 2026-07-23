import { getApiBaseUrl } from "@agu/config";
import { StatusBadge } from "@agu/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { EventRegistrationPanel } from "../../event-registration-panel";
import {
  buildPublicEventsReturnHref,
  createEventMetadataDescription,
  loadPublicEventDetail,
  toEventDetailViewModel,
  type RawSearchParams
} from "../../public-events";

type EventDetailPageProps = {
  params: Promise<{ eventId?: string }>;
  searchParams?: Promise<RawSearchParams>;
};

const getPublicEventDetail = cache(async (eventId: string) => loadPublicEventDetail(eventId));

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { eventId } = await params;

  if (!eventId) {
    return {
      title: "Etkinlik bulunamadi"
    };
  }

  const result = await getPublicEventDetail(eventId);

  if (result.status !== "success") {
    return {
      title: result.status === "not-found" ? "Etkinlik bulunamadi" : "Etkinlik detayi"
    };
  }

  return {
    title: result.event.title,
    description: createEventMetadataDescription(result.event.description)
  };
}

export default async function EventDetailPage({ params, searchParams }: EventDetailPageProps) {
  const [{ eventId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({})
  ]);

  if (!eventId) {
    notFound();
  }

  const result = await getPublicEventDetail(eventId);
  const returnHref = buildPublicEventsReturnHref(resolvedSearchParams);

  if (result.status === "not-found") {
    notFound();
  }

  if (result.status === "api-error") {
    return (
      <main className="page-shell">
        <section className="detail-layout">
          <div className="notice-panel" role="status">
            <h1>Etkinlik detayi yuklenemedi</h1>
            <p>{result.message}</p>
            <Link className="secondary-action" href={returnHref}>
              Etkinlik listesine don
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const event = toEventDetailViewModel(result.event);

  return (
    <main className="page-shell">
      <section className="detail-heading">
        <Link className="secondary-action" href={returnHref}>
          Etkinlik listesine don
        </Link>
        <p className="eyebrow">{event.clubName}</p>
        <h1>{event.title}</h1>
        <StatusBadge tone="success">{event.statusLabel}</StatusBadge>
      </section>

      <section className="detail-layout" aria-labelledby="event-detail-heading">
        <article className="detail-content">
          <h2 id="event-detail-heading">Etkinlik aciklamasi</h2>
          <p>{event.description}</p>
        </article>

        <aside className="detail-summary" aria-label="Etkinlik bilgileri">
          <dl className="event-meta detail-meta">
            <div>
              <dt>Baslangic</dt>
              <dd>
                <time dateTime={result.event.startsAt}>{event.startsAt}</time>
              </dd>
            </div>
            <div>
              <dt>Bitis</dt>
              <dd>
                <time dateTime={result.event.endsAt}>{event.endsAt}</time>
              </dd>
            </div>
            <div>
              <dt>Konum</dt>
              <dd>{event.location}</dd>
            </div>
            {event.capacityLabel ? (
              <div>
                <dt>Kapasite</dt>
                <dd>{event.capacityLabel}</dd>
              </div>
            ) : null}
            {event.publishedAtLabel ? (
              <div>
                <dt>Yayinlanma</dt>
                <dd>
                  <time dateTime={result.event.publishedAt ?? undefined}>
                    {event.publishedAtLabel}
                  </time>
                </dd>
              </div>
            ) : null}
          </dl>
          <EventRegistrationPanel apiBaseUrl={getApiBaseUrl()} eventId={result.event.id} />
        </aside>
      </section>
    </main>
  );
}

"use client";

import type { AuthMeResponse } from "@agu/contracts";
import { StatusBadge } from "@agu/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  buildPressEventsApiPath,
  buildPressEventsApprovedApiPath,
  getSafePressEventsErrorMessage,
  isPressUser,
  parsePressDashboardView,
  toPressApprovedEventCardViewModel,
  toPressEventCardViewModel,
  type PressDashboardState,
  type PressDashboardView
} from "./press-dashboard-helper";
import { PressEventPublishControls } from "./press-event-publish-controls";
import { PressEventReviewControls } from "./press-event-review-controls";

type PressDashboardClientProps = {
  initialQ?: string;
  initialPage?: number;
  initialView?: PressDashboardView;
};

export function PressDashboardClient({
  initialQ = "",
  initialPage = 1,
  initialView = "review"
}: PressDashboardClientProps) {
  const [state, setState] = useState<PressDashboardState>({ kind: "checking-session" });
  const [view, setView] = useState<PressDashboardView>(parsePressDashboardView(initialView));
  const [q, setQ] = useState(initialQ);
  const [page, setPage] = useState(initialPage);
  const pageSize = 20;

  const loadEvents = useCallback(
    async (userMe: AuthMeResponse["user"], currentView: PressDashboardView, queryQ: string, queryPage: number) => {
      setState({ kind: "loading-events" });

      try {
        const url =
          currentView === "publish"
            ? buildPressEventsApprovedApiPath(queryQ, queryPage, pageSize)
            : buildPressEventsApiPath(queryQ, queryPage, pageSize);

        const res = await fetch(url, {
          credentials: "include",
          cache: "no-store"
        });

        if (!res.ok) {
          setState({ kind: "error", message: getSafePressEventsErrorMessage(res.status, currentView) });
          return;
        }

        const data = await res.json();
        setState({ kind: "ready", data, user: userMe });
      } catch {
        const msg =
          currentView === "publish"
            ? "Yayınlanmayı bekleyen etkinlikler alınamadı. Lütfen tekrar deneyin."
            : "İnceleme bekleyen etkinlikler alınamadı. Lütfen tekrar deneyin.";
        setState({ kind: "error", message: msg });
      }
    },
    [pageSize]
  );

  useEffect(() => {
    let active = true;

    async function init() {
      setState({ kind: "checking-session" });

      try {
        const meRes =
          (await fetch("/api-proxy/auth/me", { credentials: "include" }).catch(() => null)) ||
          (await fetch(
            `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}/auth/me`,
            { credentials: "include" }
          ));

        if (!active) return;

        if (meRes.status === 401) {
          setState({ kind: "unauthenticated" });
          return;
        }

        if (!meRes.ok) {
          setState({
            kind: "error",
            message: getSafePressEventsErrorMessage(meRes.status, view)
          });
          return;
        }

        const meData = (await meRes.json()) as AuthMeResponse;
        if (!isPressUser(meData.user)) {
          setState({ kind: "forbidden" });
          return;
        }

        await loadEvents(meData.user, view, q, page);
      } catch {
        if (active) {
          const msg =
            view === "publish"
              ? "Yayınlanmayı bekleyen etkinlikler alınamadı. Lütfen tekrar deneyin."
              : "İnceleme bekleyen etkinlikler alınamadı. Lütfen tekrar deneyin.";
          setState({ kind: "error", message: msg });
        }
      }
    }

    void init();

    return () => {
      active = false;
    };
  }, [view, q, page, loadEvents]);

  function handleViewChange(newView: PressDashboardView) {
    if (newView === view) return;
    setView(newView);
    setPage(1);
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchQuery = (formData.get("q") as string) || "";
    setQ(searchQuery);
    setPage(1);
  }

  function handleClearFilter() {
    setQ("");
    setPage(1);
  }

  if (state.kind === "checking-session" || state.kind === "loading-events") {
    return (
      <main className="page-shell">
        <header className="intro">
          <p className="eyebrow">İnceleme Paneli</p>
          <h1>Basın Yayın İnceleme Paneli</h1>
        </header>
        <div className="empty-panel" role="status" aria-live="polite">
          <p>Yükleniyor...</p>
        </div>
      </main>
    );
  }

  if (state.kind === "unauthenticated") {
    return (
      <main className="page-shell">
        <header className="intro">
          <p className="eyebrow">İnceleme Paneli</p>
          <h1>Basın Yayın İnceleme Paneli</h1>
          <div className="dashboard-nav">
            <Link href="/" className="secondary-action">
              Ana Sayfaya Dön
            </Link>
          </div>
        </header>
        <div className="notice-panel" data-tone="critical" role="alert">
          <h2>Yetkisiz Erişim</h2>
          <p>Basın Yayın inceleme panelini kullanmak için giriş yapmalısınız.</p>
        </div>
      </main>
    );
  }

  if (state.kind === "forbidden") {
    return (
      <main className="page-shell">
        <header className="intro">
          <p className="eyebrow">İnceleme Paneli</p>
          <h1>Basın Yayın İnceleme Paneli</h1>
          <div className="dashboard-nav">
            <Link href="/" className="secondary-action">
              Ana Sayfaya Dön
            </Link>
          </div>
        </header>
        <div className="notice-panel" data-tone="critical" role="alert">
          <h2>Yetkisiz Erişim</h2>
          <p>Basın Yayın inceleme panelini görüntüleme yetkiniz yok.</p>
        </div>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="page-shell">
        <header className="intro">
          <p className="eyebrow">İnceleme Paneli</p>
          <h1>Basın Yayın İnceleme Paneli</h1>
          <div className="dashboard-nav">
            <Link href="/" className="secondary-action">
              Ana Sayfaya Dön
            </Link>
          </div>
        </header>
        <div className="notice-panel" data-tone="critical" role="alert">
          <h2>Hata</h2>
          <p>{state.message}</p>
        </div>
      </main>
    );
  }

  const { data, user } = state;
  const { items, pagination } = data;

  return (
    <main className="page-shell">
      <header className="intro">
        <p className="eyebrow">İnceleme Paneli</p>
        <h1>Basın Yayın İnceleme Paneli</h1>
        <div className="dashboard-nav">
          <Link href="/" className="secondary-action">
            Ana Sayfaya Dön
          </Link>
        </div>
      </header>

      <section className="view-toggle-section" style={{ marginBottom: "var(--spacing-3)" }}>
        <div className="view-toggle-buttons" style={{ display: "flex", gap: "var(--spacing-2)" }}>
          <button
            type="button"
            className={view === "review" ? "primary-action" : "secondary-action"}
            aria-current={view === "review" ? "page" : undefined}
            onClick={() => handleViewChange("review")}
          >
            İnceleme Bekleyenler
          </button>
          <button
            type="button"
            className={view === "publish" ? "primary-action" : "secondary-action"}
            aria-current={view === "publish" ? "page" : undefined}
            onClick={() => handleViewChange("publish")}
          >
            Yayınlanmayı Bekleyenler
          </button>
        </div>
      </section>

      <section className="press-filters-section">
        <form className="event-filters" onSubmit={handleSearchSubmit}>
          <div className="filter-group">
            <label htmlFor="q">Ara</label>
            <input
              type="text"
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Etkinlik başlığı, açıklama veya kulüp ara..."
              className="filter-input"
            />
          </div>
          <button type="submit" className="primary-action">
            Filtrele
          </button>
          {q && (
            <button type="button" className="secondary-action" onClick={handleClearFilter}>
              Filtreleri Temizle
            </button>
          )}
        </form>
      </section>

      <section className="events-panel" style={{ marginTop: "var(--spacing-4)" }}>
        <div className="queue-stats" style={{ marginBottom: "var(--spacing-3)" }}>
          <p>
            <strong>
              {view === "publish" ? "Bekleyen APPROVED Toplam Sayısı:" : "Bekleyen Toplam Etkinlik Sayısı:"}
            </strong>{" "}
            {pagination.totalItems}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="empty-panel">
            <p>
              {view === "publish"
                ? "Yayınlanmayı bekleyen etkinlik bulunmuyor."
                : "İnceleme bekleyen etkinlik bulunmuyor."}
            </p>
          </div>
        ) : (
          <div className="event-grid">
            {items.map((item) => {
              if (view === "publish") {
                const approvedItem = item as unknown as import("@agu/contracts").PressApprovedEventListItem;
                const vm = toPressApprovedEventCardViewModel(approvedItem);
                return (
                  <div key={vm.id} className="event-card">
                    <div className="event-card-header">
                      <h3 className="event-title">{vm.title}</h3>
                      <StatusBadge tone="neutral">{vm.statusLabel}</StatusBadge>
                    </div>
                    <div className="event-meta">
                      <p>
                        <strong>Kulüp:</strong> {vm.clubName}
                      </p>
                      <p>
                        <strong>Açıklama:</strong> {vm.description}
                      </p>
                      <p>
                        <strong>Zaman:</strong> {vm.startsAt} - {vm.endsAt}
                      </p>
                      <p>
                        <strong>Konum:</strong> {vm.location}
                      </p>
                      {vm.capacityLabel && (
                        <p>
                          <strong>Kapasite:</strong> {vm.capacityLabel}
                        </p>
                      )}
                      <p>
                        <strong>Onay Zamanı:</strong> {vm.submittedAt}
                      </p>
                    </div>

                    <PressEventPublishControls
                      eventId={item.id}
                      eventTitle={item.title}
                      clubName={item.club.name}
                      startsAt={vm.startsAt}
                      onPublishSuccess={() => void loadEvents(user, view, q, page)}
                    />
                  </div>
                );
              }

              const vm = toPressEventCardViewModel(item as import("@agu/contracts").PressEventListItem);
              return (
                <div key={vm.id} className="event-card">
                  <div className="event-card-header">
                    <h3 className="event-title">{vm.title}</h3>
                    <StatusBadge tone="neutral">{vm.statusLabel}</StatusBadge>
                  </div>
                  <div className="event-meta">
                    <p>
                      <strong>Kulüp:</strong> {vm.clubName}
                    </p>
                    <p>
                      <strong>Açıklama:</strong> {vm.description}
                    </p>
                    <p>
                      <strong>Zaman:</strong> {vm.startsAt} - {vm.endsAt}
                    </p>
                    <p>
                      <strong>Konum:</strong> {vm.location}
                    </p>
                    {vm.capacityLabel && (
                      <p>
                        <strong>Kapasite:</strong> {vm.capacityLabel}
                      </p>
                    )}
                    <p>
                      <strong>Gönderilme Zamanı:</strong> {vm.submittedAt}
                    </p>
                  </div>

                  <PressEventReviewControls
                    eventId={item.id}
                    eventTitle={item.title}
                    clubName={item.club.name}
                    onReviewSuccess={() => void loadEvents(user, view, q, page)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="pagination" style={{ marginTop: "var(--spacing-4)" }}>
            {pagination.page > 1 && (
              <button
                type="button"
                className="secondary-action"
                onClick={() => setPage(pagination.page - 1)}
              >
                Önceki
              </button>
            )}
            <span className="pagination-info">
              Sayfa {pagination.page} / {pagination.totalPages}
            </span>
            {pagination.page < pagination.totalPages && (
              <button
                type="button"
                className="secondary-action"
                onClick={() => setPage(pagination.page + 1)}
              >
                Sonraki
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

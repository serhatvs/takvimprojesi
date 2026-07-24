"use client";

import type { AuthMeResponse, EventAttendanceSummaryResponse } from "@agu/contracts";
import { StatusBadge } from "@agu/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  attendanceSummaryRequestOptions,
  buildAttendanceSummaryPath,
  canViewAttendanceSummary,
  formatAttendanceRate,
  formatRemainingCapacity,
  messageForAttendanceSummaryError
} from "../../../../attendance-summary";
import { formatEventDateTime } from "../../../../public-events";

type AttendanceSummaryScreenProps = {
  apiBaseUrl: string;
  eventId: string;
  initialPage?: number;
  initialPageSize?: number;
  initialQ?: string;
};

type ScreenState =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: EventAttendanceSummaryResponse };

export function AttendanceSummaryScreen({
  apiBaseUrl,
  eventId,
  initialPage = 1,
  initialPageSize = 50,
  initialQ = ""
}: AttendanceSummaryScreenProps) {
  const [state, setState] = useState<ScreenState>({ kind: "loading" });
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [activeQuery, setActiveQuery] = useState(initialQ);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setState({ kind: "loading" });

      try {
        const meRes = await fetch(`${apiBaseUrl}/auth/me`, {
          credentials: "include",
          cache: "no-store"
        });

        if (!active) {
          return;
        }

        if (meRes.status === 401) {
          setState({ kind: "unauthenticated" });
          return;
        }

        if (!meRes.ok) {
          setState({
            kind: "error",
            message: "Oturum durumu doğrulanamadı. Lütfen tekrar deneyin."
          });
          return;
        }

        const meData = (await meRes.json()) as AuthMeResponse;

        const path = buildAttendanceSummaryPath(eventId, {
          page,
          pageSize,
          q: activeQuery
        });

        const summaryRes = await fetch(`${apiBaseUrl}${path}`, attendanceSummaryRequestOptions());

        if (!active) {
          return;
        }

        if (summaryRes.status === 403) {
          if (!canViewAttendanceSummary(meData.user, "")) {
            // Check if forbidden
          }
          setState({ kind: "forbidden" });
          return;
        }

        if (!summaryRes.ok) {
          setState({
            kind: "error",
            message: messageForAttendanceSummaryError(summaryRes.status)
          });
          return;
        }

        const summaryData = (await summaryRes.json()) as EventAttendanceSummaryResponse;
        setState({ kind: "ready", data: summaryData });
      } catch {
        if (active) {
          setState({
            kind: "error",
            message: "Sunucu bağlantısı kurulamadı. Lütfen internet bağlantınızı kontrol edin."
          });
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [apiBaseUrl, eventId, page, pageSize, activeQuery]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setActiveQuery(searchQuery);
  }

  function handleSearchClear() {
    setSearchQuery("");
    setActiveQuery("");
    setPage(1);
  }

  if (state.kind === "loading") {
    return (
      <section className="events-panel" aria-busy="true">
        <div className="section-heading">
          <div>
            <h2>Katılım Raporu</h2>
            <p>Veriler yükleniyor…</p>
          </div>
          <StatusBadge tone="neutral">Yükleniyor</StatusBadge>
        </div>
      </section>
    );
  }

  if (state.kind === "unauthenticated") {
    return (
      <section className="events-panel" role="alert">
        <div className="section-heading">
          <div>
            <h2>Oturum Zaman Aşımı</h2>
            <p>Katılım verilerini görüntülemek için kulüp yöneticisi girişi yapmalısınız.</p>
          </div>
          <StatusBadge tone="warning">Oturum Yok</StatusBadge>
        </div>
        <div className="check-in-actions" style={{ marginTop: "1rem" }}>
          <a href="/auth/login" className="primary-action">
            Giriş Yap
          </a>
          <Link href="/club-dashboard" className="secondary-action">
            Kulüp Paneline Dön
          </Link>
        </div>
      </section>
    );
  }

  if (state.kind === "forbidden") {
    return (
      <section className="events-panel" role="alert">
        <div className="section-heading">
          <div>
            <h2>Yetkisiz Erişim</h2>
            <p>Bu etkinliğin katılım verilerini görüntüleme yetkiniz yok.</p>
          </div>
          <StatusBadge tone="warning">403 Yetkisiz</StatusBadge>
        </div>
        <div className="check-in-actions" style={{ marginTop: "1rem" }}>
          <Link href="/club-dashboard" className="primary-action">
            Kulüp Paneline Dön
          </Link>
        </div>
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section className="events-panel" role="alert">
        <div className="section-heading">
          <div>
            <h2>Hata Oluştu</h2>
            <p>{state.message}</p>
          </div>
          <StatusBadge tone="warning">Hata</StatusBadge>
        </div>
        <div className="check-in-actions" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="primary-action"
            onClick={() => {
              setState({ kind: "loading" });
              setPage(1);
            }}
          >
            Tekrar Dene
          </button>
          <Link href="/club-dashboard" className="secondary-action">
            Kulüp Paneline Dön
          </Link>
        </div>
      </section>
    );
  }

  const { data } = state;
  const summary = data.summary || data.metrics;
  const attendees = data.attendees || [];
  const pagination = data.pagination;

  return (
    <div className="attendance-summary-screen">
      <section className="intro">
        <p className="eyebrow">Kulüp Yönetimi</p>
        <h1>Katılım Raporu: {data.event.title}</h1>
        <p>
          Başlangıç: {formatEventDateTime(data.event.startsAt)} — Bitiş:{" "}
          {formatEventDateTime(data.event.endsAt)}
        </p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link
            href={`/club-dashboard/events/${encodeURIComponent(eventId)}/attendance`}
            className="primary-action"
          >
            Canlı QR Ekranı
          </Link>
          <Link href="/club-dashboard" className="secondary-action">
            Kulüp Paneli
          </Link>
        </div>
      </section>

      <section className="events-panel" aria-labelledby="summary-metrics-heading">
        <div className="section-heading">
          <div>
            <h2 id="summary-metrics-heading">Katılım Özet Metrikleri</h2>
            <p>Etkinliğin genel kayıt, yoklama ve doluluk durumları gösterilmektedir.</p>
          </div>
          <StatusBadge tone="success">{data.event.status}</StatusBadge>
        </div>

        <div className="metric-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          <div className="metric-card" style={{ padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--color-border, #e2e8f0)", backgroundColor: "var(--color-surface, #fff)" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted, #64748b)" }}>Kayıtlı Öğrenci</span>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {summary.registeredCount}
            </div>
          </div>
          <div className="metric-card" style={{ padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--color-border, #e2e8f0)", backgroundColor: "var(--color-surface, #fff)" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted, #64748b)" }}>Katılan Öğrenci</span>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#16a34a", marginTop: "0.25rem" }}>
              {summary.attendanceCount}
            </div>
          </div>
          <div className="metric-card" style={{ padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--color-border, #e2e8f0)", backgroundColor: "var(--color-surface, #fff)" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted, #64748b)" }}>Gelmeyen Kayıtlı</span>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#dc2626", marginTop: "0.25rem" }}>
              {summary.absentCount}
            </div>
          </div>
          <div className="metric-card" style={{ padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--color-border, #e2e8f0)", backgroundColor: "var(--color-surface, #fff)" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted, #64748b)" }}>Kalan Kontenjan</span>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {formatRemainingCapacity(summary.capacityRemaining)}
            </div>
          </div>
          <div className="metric-card" style={{ padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--color-border, #e2e8f0)", backgroundColor: "var(--color-surface, #fff)" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted, #64748b)" }}>Kayıt Oranı</span>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {summary.registrationRate !== null && summary.registrationRate !== undefined
                ? `%${summary.registrationRate}`
                : "Sınırsız"}
            </div>
          </div>
          <div className="metric-card" style={{ padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--color-border, #e2e8f0)", backgroundColor: "var(--color-surface, #fff)" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted, #64748b)" }}>Katılım Oranı</span>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#2563eb", marginTop: "0.25rem" }}>
              {formatAttendanceRate(summary.attendanceRate)}
            </div>
          </div>
        </div>
      </section>

      <section className="events-panel" aria-labelledby="attendees-heading" style={{ marginTop: "2rem" }}>
        <div className="section-heading">
          <div>
            <h2 id="attendees-heading">Katılımcı Listesi ({pagination.totalItems})</h2>
            <p>Check-in işlemi gerçekleşen öğrencilerin listesi.</p>
          </div>
        </div>

        <form className="event-filters" onSubmit={handleSearchSubmit} aria-label="Katılımcı araması" style={{ marginBottom: "1.5rem" }}>
          <label style={{ flexGrow: 1 }}>
            <span>Öğrenci Arama</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Öğrenci adı veya e-posta ara"
            />
          </label>
          <div className="filter-actions">
            <button type="submit">Ara</button>
            {activeQuery ? (
              <button type="button" className="secondary-action" onClick={handleSearchClear}>
                Temizle
              </button>
            ) : null}
          </div>
        </form>

        {attendees.length === 0 ? (
          <div className="empty-panel">
            <h3>Katılım kaydı bulunamadı</h3>
            <p>
              {activeQuery
                ? "Arama kriterlerinize uyan katılımcı bulunamadı."
                : "Bu etkinlik için henüz check-in yapan öğrenci bulunmuyor."}
            </p>
          </div>
        ) : (
          <>
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--color-border, #e2e8f0)", textAlign: "left" }}>
                    <th style={{ padding: "0.75rem 0.5rem" }}>#</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Katılımcı Adı</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>E-posta</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Katılımcı Türü</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Kayıt Zamanı</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Check-in Zamanı</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((attendee, index) => (
                    <tr
                      key={`${attendee.userId}-${attendee.checkedInAt}`}
                      style={{ borderBottom: "1px solid var(--color-border, #f1f5f9)" }}
                    >
                      <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600 }}>
                        {(pagination.page - 1) * pagination.pageSize + index + 1}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", fontWeight: 500 }}>
                        {attendee.displayName}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: "var(--color-text-muted, #64748b)" }}>
                        {attendee.email}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <StatusBadge tone={attendee.participantType === "EXTERNAL" ? "warning" : "success"}>
                          {attendee.participantType === "EXTERNAL" ? "Dış Katılımcı" : "AGÜ Katılımcısı"}
                        </StatusBadge>
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        {formatEventDateTime(attendee.registeredAt)}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: "#16a34a", fontWeight: 500 }}>
                        {formatEventDateTime(attendee.checkedInAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <nav className="pagination" aria-label="Katılımcı sayfalama" style={{ marginTop: "1.5rem" }}>
              {pagination.page > 1 ? (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setPage(pagination.page - 1)}
                >
                  Önceki
                </button>
              ) : (
                <span aria-disabled="true">Önceki</span>
              )}
              <p>
                Sayfa {pagination.page} / {Math.max(pagination.totalPages, 1)}
              </p>
              {pagination.page < pagination.totalPages ? (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setPage(pagination.page + 1)}
                >
                  Sonraki
                </button>
              ) : (
                <span aria-disabled="true">Sonraki</span>
              )}
            </nav>
          </>
        )}
      </section>
    </div>
  );
}

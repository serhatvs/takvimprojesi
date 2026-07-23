import { EVENT_STATUSES } from "@agu/contracts";
import { StatusBadge } from "@agu/ui";
import Link from "next/link";
import {
  buildClubDashboardPageHref,
  loadClubEvents,
  loadManageableClubs,
  parseClubDashboardFilters,
  statusLabelFor,
  toClubEventCardViewModel,
  type RawSearchParams
} from "./club-dashboard";

export const dynamic = "force-dynamic";

export default async function ClubDashboardPage({ searchParams }: { searchParams?: Promise<RawSearchParams> }) {
  const resolvedParams = (await searchParams) || {};
  const filters = parseClubDashboardFilters(resolvedParams);
  
  const manageableClubsResult = await loadManageableClubs();

  if (manageableClubsResult.status === "api-error") {
    return (
      <main className="page-shell">
        <div className="notice-panel" data-tone="critical">
          <h2>Hata</h2>
          <p>{manageableClubsResult.message}</p>
        </div>
      </main>
    );
  }

  const clubs = manageableClubsResult.clubs;
  if (clubs.length === 0) {
    return (
      <main className="page-shell">
        <header className="intro">
          <p className="eyebrow">Yönetim</p>
          <h1>Kulüp Yönetim Paneli</h1>
          <div className="dashboard-nav">
            <Link href="/" className="secondary-action">Ana Sayfaya Dön</Link>
          </div>
        </header>
        <div className="empty-panel">
          <p>Yönetebileceğiniz kulüp bulunamadı.</p>
        </div>
      </main>
    );
  }

  const selectedClubId = typeof resolvedParams.clubId === "string" ? resolvedParams.clubId : clubs[0]!.id;
  
  let eventsContent = null;
  
  if (selectedClubId) {
    const eventsResult = await loadClubEvents(selectedClubId, resolvedParams);
    
    if (eventsResult.status === "api-error") {
      eventsContent = (
        <div className="notice-panel" data-tone="critical">
          <p>Etkinlikler yüklenirken hata oluştu: {eventsResult.message}</p>
        </div>
      );
    } else {
      const { items, pagination, statusCounts } = eventsResult.data;
      
      const countsGrid = (
        <div className="status-counts">
          {EVENT_STATUSES.map(status => (
            <div key={status} className="status-count-card">
              <div className="status-count-value">{statusCounts[status] || 0}</div>
              <div className="status-count-label">{statusLabelFor(status)}</div>
            </div>
          ))}
        </div>
      );

      const eventsList = items.length > 0 ? (
        <div className="event-grid">
          {items.map(item => {
            const vm = toClubEventCardViewModel(item);
            return (
              <div key={vm.id} className="event-card">
                <div className="event-card-header">
                  <h3 className="event-title">
                    <Link href={`/events/${vm.id}`} className="event-card-link">
                      {vm.title}
                    </Link>
                  </h3>
                  <StatusBadge tone={vm.statusTone}>{vm.statusLabel}</StatusBadge>
                </div>
                <div className="event-meta">
                  <p><strong>Zaman:</strong> {vm.startsAt} - {vm.endsAt}</p>
                  <p><strong>Konum:</strong> {vm.location}</p>
                  {vm.capacityLabel && <p><strong>Kapasite:</strong> {vm.capacityLabel}</p>}
                  <p><strong>Son Güncelleme:</strong> {vm.updatedAt}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-panel">
          <p>Bu kriterlere uygun etkinlik bulunamadı.</p>
        </div>
      );
      
      const paginationControls = pagination.totalPages > 1 ? (
        <div className="pagination">
          {pagination.page > 1 && (
            <Link 
              href={buildClubDashboardPageHref(selectedClubId, filters, pagination.page - 1)}
              className="secondary-action"
            >
              Önceki
            </Link>
          )}
          <span className="pagination-info">
            Sayfa {pagination.page} / {pagination.totalPages}
          </span>
          {pagination.page < pagination.totalPages && (
            <Link 
              href={buildClubDashboardPageHref(selectedClubId, filters, pagination.page + 1)}
              className="secondary-action"
            >
              Sonraki
            </Link>
          )}
        </div>
      ) : null;

      eventsContent = (
        <div className="events-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
            <h2 className="section-heading" style={{ margin: 0 }}>Kulüp Etkinlikleri</h2>
            <Link 
              href={`/club-dashboard/events/new?clubId=${selectedClubId}`} 
              className="primary-action"
            >
              Yeni Etkinlik Oluştur
            </Link>
          </div>
          
          {countsGrid}
          
          <form className="event-filters" action="/club-dashboard" method="GET">
            <input type="hidden" name="clubId" value={selectedClubId} />
            <div className="filter-group">
              <label htmlFor="q">Ara</label>
              <input 
                type="text" 
                id="q" 
                name="q" 
                defaultValue={filters.q} 
                placeholder="Etkinlik ara..." 
                className="filter-input" 
              />
            </div>
            
            <div className="filter-group">
              <label htmlFor="status">Durum</label>
              <select 
                id="status" 
                name="status" 
                defaultValue={filters.status} 
                className="filter-select"
              >
                <option value="">Tümü</option>
                {EVENT_STATUSES.map(status => (
                  <option key={status} value={status}>
                    {statusLabelFor(status)}
                  </option>
                ))}
              </select>
            </div>
            
            <button type="submit" className="primary-action">Filtrele</button>
          </form>

          {eventsList}
          {paginationControls}
        </div>
      );
    }
  }

  return (
    <main className="page-shell">
      <header className="intro">
        <p className="eyebrow">Yönetim</p>
        <h1>Kulüp Yönetim Paneli</h1>
        <div className="dashboard-nav">
          <Link href="/" className="secondary-action">Ana Sayfaya Dön</Link>
        </div>
      </header>

      <section className="club-selection">
        <h2 className="section-heading">Kulüpler</h2>
        <div className="club-selector">
          {clubs.map(club => (
            <Link
              key={club.id}
              href={`/club-dashboard?clubId=${club.id}`}
              className="club-selector-item"
              data-active={club.id === selectedClubId}
            >
              {club.name}
            </Link>
          ))}
        </div>
      </section>

      {eventsContent}
    </main>
  );
}

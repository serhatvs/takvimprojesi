import Link from "next/link";

export default function EventDetailNotFound() {
  return (
    <main className="page-shell">
      <section className="detail-layout">
        <div className="empty-panel">
          <h1>Etkinlik bulunamadı</h1>
          <p>Bu etkinlik bulunamadı veya yayınlanmamış olabilir.</p>
          <Link className="secondary-action" href="/">
            Etkinlik listesine don
          </Link>
        </div>
      </section>
    </main>
  );
}

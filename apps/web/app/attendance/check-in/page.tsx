import { getApiBaseUrl } from "@agu/config";
import Link from "next/link";
import { CheckInClient } from "../../check-in/check-in-client";

export const dynamic = "force-dynamic";

export default function AttendanceCheckInPage() {
  return (
    <main className="page-shell">
      <section className="intro">
        <p className="eyebrow">Öğrenci yoklaması</p>
        <h1>QR ile Yoklama</h1>
        <p>
          Etkinlik alanındaki AGÜ Kampüs Takvimi QR kodunu kamera ile okutun veya
          kamera kullanılamıyorsa manuel yedek girişi kullanın.
        </p>
        <Link className="secondary-action" href="/">
          Etkinlik listesine dön
        </Link>
      </section>

      <CheckInClient apiBaseUrl={getApiBaseUrl()} />
    </main>
  );
}

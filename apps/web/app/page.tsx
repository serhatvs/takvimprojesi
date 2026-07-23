import { getApiBaseUrl } from "@agu/config";
import type { HealthResponse } from "@agu/contracts";
import { StatusBadge } from "@agu/ui";

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

export default async function HomePage() {
  const health = await getApiHealth();

  return (
    <main className="page-shell">
      <section className="intro">
        <p className="eyebrow">AGU Kampus Takvimi</p>
        <h1>Kulup etkinlikleri icin onayli kampus takvimi altyapisi</h1>
        <p>
          Bu ilk surum repository altyapisini, API saglik kontrolunu, paylasilan
          tipleri ve Prisma domain modelini dogrulamak icin hazirlandi.
        </p>
      </section>

      <section className="health-panel" aria-label="API health">
        <div>
          <h2>API baglantisi</h2>
          <p>{getApiBaseUrl()}</p>
        </div>
        {health ? (
          <StatusBadge tone="success">
            {health.service} {health.status} - {health.timeZone}
          </StatusBadge>
        ) : (
          <StatusBadge tone="warning">API health endpointine erisilemiyor</StatusBadge>
        )}
      </section>
    </main>
  );
}

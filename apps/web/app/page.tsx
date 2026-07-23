import { getApiBaseUrl } from "@agu/config";
import type { HealthResponse } from "@agu/contracts";
import { StatusBadge } from "@agu/ui";
import type { ReactNode } from "react";

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

      {devAuthPanel}
    </main>
  );
}

import { parsePressDashboardView } from "./press-dashboard-helper";
import { PressDashboardClient } from "./press-dashboard-client";

export const dynamic = "force-dynamic";

export default async function PressDashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; page?: string; view?: string }>;
}) {
  const resolvedParams = (await searchParams) || {};
  const q = typeof resolvedParams.q === "string" ? resolvedParams.q : "";
  const page = typeof resolvedParams.page === "string" ? parseInt(resolvedParams.page, 10) || 1 : 1;
  const view = parsePressDashboardView(resolvedParams.view);

  return <PressDashboardClient initialQ={q} initialPage={page} initialView={view} />;
}

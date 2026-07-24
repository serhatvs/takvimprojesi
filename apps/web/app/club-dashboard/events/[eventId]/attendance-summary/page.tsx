import { getApiBaseUrl } from "@agu/config";
import { AttendanceSummaryScreen } from "./attendance-summary-screen";

export const dynamic = "force-dynamic";

export default async function AttendanceSummaryPage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ page?: string; pageSize?: string; q?: string }>;
}) {
  const { eventId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const apiBaseUrl = getApiBaseUrl();

  return (
    <main className="page-shell">
      <AttendanceSummaryScreen
        apiBaseUrl={apiBaseUrl}
        eventId={eventId}
        initialPage={resolvedSearchParams.page ? parseInt(resolvedSearchParams.page, 10) || 1 : 1}
        initialPageSize={resolvedSearchParams.pageSize ? parseInt(resolvedSearchParams.pageSize, 10) || 50 : 50}
        initialQ={resolvedSearchParams.q ?? ""}
      />
    </main>
  );
}

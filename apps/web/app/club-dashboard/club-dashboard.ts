import { getApiBaseUrl } from "@agu/config";
import type {
  ClubEventListItem,
  ClubEventsResponse,
  ManageableClub,
  ManageableClubsResponse
} from "@agu/contracts";
import { formatEventDateTime } from "../public-events";

export const CLUB_EVENTS_PAGE_SIZE = 10;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type ClubDashboardFilters = {
  q: string;
  status: string;
  page: number;
  pageSize: number;
};

export type ManageableClubsLoadResult =
  | { status: "success"; clubs: ManageableClub[] }
  | { status: "api-error"; message: string };

export type ClubEventsLoadResult =
  | { status: "success"; data: ClubEventsResponse; filters: ClubDashboardFilters }
  | { status: "api-error"; filters: ClubDashboardFilters; message: string };

export type ClubEventCardViewModel = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  capacityLabel: string | null;
  statusLabel: string;
  statusTone: "neutral" | "success" | "warning";
  updatedAt: string;
};

export function parseClubDashboardFilters(searchParams: RawSearchParams): ClubDashboardFilters {
  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";
  
  let page = 1;
  if (typeof searchParams.page === "string") {
    const parsedPage = parseInt(searchParams.page, 10);
    if (!isNaN(parsedPage) && parsedPage > 0) {
      page = parsedPage;
    }
  }

  return {
    q,
    status,
    page,
    pageSize: CLUB_EVENTS_PAGE_SIZE
  };
}

export function buildClubEventsApiPath(clubId: string, filters: ClubDashboardFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.page > 1) params.set("page", filters.page.toString());
  if (filters.pageSize !== 10) params.set("pageSize", filters.pageSize.toString());
  
  const qs = params.toString();
  return `/clubs/${clubId}/events${qs ? `?${qs}` : ""}`;
}

export function buildClubDashboardPageHref(clubId: string, filters: ClubDashboardFilters, page: number): string {
  const params = new URLSearchParams();
  params.set("clubId", clubId);
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", page.toString());
  
  return `/club-dashboard?${params.toString()}`;
}

export function statusLabelFor(status: string): string {
  switch (status) {
    case "DRAFT": return "Taslak";
    case "SUBMITTED": return "Gönderildi";
    case "CHANGES_REQUESTED": return "Değişiklik İstendi";
    case "REJECTED": return "Reddedildi";
    case "APPROVED": return "Onaylandı";
    case "PUBLISHED": return "Yayında";
    case "CANCELLED": return "İptal Edildi";
    case "COMPLETED": return "Tamamlandı";
    default: return status;
  }
}

export function statusToneFor(status: string): "neutral" | "success" | "warning" {
  switch (status) {
    case "APPROVED":
    case "PUBLISHED":
      return "success";
    case "CHANGES_REQUESTED":
    case "REJECTED":
    case "CANCELLED":
      return "warning";
    case "DRAFT":
    case "SUBMITTED":
    case "COMPLETED":
    default:
      return "neutral";
  }
}

export function toClubEventCardViewModel(item: ClubEventListItem): ClubEventCardViewModel {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    startsAt: formatEventDateTime(item.startsAt),
    endsAt: formatEventDateTime(item.endsAt),
    location: item.location,
    capacityLabel: item.capacity ? `${item.capacity} Kişi` : null,
    statusLabel: statusLabelFor(item.status),
    statusTone: statusToneFor(item.status),
    updatedAt: formatEventDateTime(item.updatedAt)
  };
}

export async function loadManageableClubs(): Promise<ManageableClubsLoadResult> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/clubs/manageable`, {
      cache: "no-store",
      credentials: "include"
    });
    if (!res.ok) {
      return { status: "api-error", message: `API Error: ${res.status}` };
    }
    const data = await res.json() as ManageableClubsResponse;
    return { status: "success", clubs: data.clubs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { status: "api-error", message: msg };
  }
}

export async function loadClubEvents(clubId: string, searchParams: RawSearchParams): Promise<ClubEventsLoadResult> {
  const filters = parseClubDashboardFilters(searchParams);
  try {
    const apiPath = buildClubEventsApiPath(clubId, filters);
    const res = await fetch(`${getApiBaseUrl()}${apiPath}`, {
      cache: "no-store",
      credentials: "include"
    });
    if (!res.ok) {
      return { status: "api-error", filters, message: `API Error: ${res.status}` };
    }
    const data = await res.json() as ClubEventsResponse;
    return { status: "success", data, filters };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { status: "api-error", filters, message: msg };
  }
}

import { getApiBaseUrl } from "@agu/config";
import type { AuthPrincipal, PressEventListItem, PressEventsResponse } from "@agu/contracts";
import { formatEventDateTime } from "../public-events";

export type PressDashboardState =
  | { kind: "checking-session" }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "loading-events" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: PressEventsResponse; user: AuthPrincipal };

export function isPressUser(user: AuthPrincipal | null | undefined): boolean {
  if (!user || !Array.isArray(user.globalRoles)) return false;
  return user.globalRoles.includes("PRESS_EDITOR") || user.globalRoles.includes("SYSTEM_ADMIN");
}

export function buildPressEventsApiPath(q?: string, page = 1, pageSize = 20): string {
  const params = new URLSearchParams();
  if (q && q.trim()) params.set("q", q.trim());
  if (page > 1) params.set("page", page.toString());
  if (pageSize !== 20) params.set("pageSize", pageSize.toString());

  const qs = params.toString();
  return `${getApiBaseUrl()}/press/events${qs ? `?${qs}` : ""}`;
}

export function buildReviewApiPath(eventId: string, action: "approve" | "request-changes" | "reject"): string {
  return `${getApiBaseUrl()}/events/${encodeURIComponent(eventId)}/${action}`;
}

export function getSafePressEventsErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Filtre değerlerinden biri geçersiz.";
    case 401:
      return "Oturumunuz sona ermiş. Tekrar giriş yapın.";
    case 403:
      return "Basın Yayın inceleme panelini görüntüleme yetkiniz yok.";
    default:
      return "İnceleme bekleyen etkinlikler alınamadı. Lütfen tekrar deneyin.";
  }
}

export function getSafeReviewErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "İnceleme bilgilerini kontrol edip tekrar deneyin.";
    case 401:
      return "Oturumunuz sona ermiş. Tekrar giriş yapın.";
    case 403:
      return "Bu etkinlik için inceleme işlemi yapma yetkiniz yok.";
    case 404:
      return "Etkinlik bulunamadı veya artık kullanılamıyor.";
    case 409:
      return "Etkinlik artık inceleme bekleyen durumda değil. Listeyi yenileyip tekrar kontrol edin.";
    default:
      return "İnceleme işlemi tamamlanamadı. Lütfen tekrar deneyin.";
  }
}

export type PressEventCardViewModel = {
  id: string;
  title: string;
  description: string;
  statusLabel: string;
  clubName: string;
  startsAt: string;
  endsAt: string;
  location: string;
  capacityLabel: string | null;
  submittedAt: string;
};

export function toPressEventCardViewModel(item: PressEventListItem): PressEventCardViewModel {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    statusLabel: "İnceleme Bekliyor",
    clubName: item.club.name,
    startsAt: formatEventDateTime(item.startsAt),
    endsAt: formatEventDateTime(item.endsAt),
    location: item.location,
    capacityLabel: item.capacity !== null && item.capacity !== undefined ? `${item.capacity} Kişi` : null,
    submittedAt: formatEventDateTime(item.updatedAt)
  };
}

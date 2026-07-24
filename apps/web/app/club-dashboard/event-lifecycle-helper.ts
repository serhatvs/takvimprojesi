import { getApiBaseUrl } from "@agu/config";

export function buildCancelEventApiPath(eventId: string): string {
  return `${getApiBaseUrl()}/events/${encodeURIComponent(eventId)}/cancel`;
}

export function buildCompleteEventApiPath(eventId: string): string {
  return `${getApiBaseUrl()}/events/${encodeURIComponent(eventId)}/complete`;
}

export function canCancelEvent(status: string): boolean {
  return ["SUBMITTED", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED"].includes(status);
}

export function canCompleteEvent(status: string, endsAt: string | Date, now: Date = new Date()): boolean {
  if (status !== "PUBLISHED") {
    return false;
  }
  const endDate = typeof endsAt === "string" ? new Date(endsAt) : endsAt;
  return endDate.getTime() <= now.getTime();
}

export function validateCancelReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < 5 || trimmed.length > 500) {
    return "İptal gerekçesini kontrol edip tekrar deneyin.";
  }
  return null;
}

export function getSafeCancelErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "İptal gerekçesini kontrol edip tekrar deneyin.";
    case 401:
      return "Oturumunuz sona ermiş. Tekrar giriş yapın.";
    case 403:
      return "Bu etkinliği iptal etme yetkiniz yok.";
    case 404:
      return "Etkinlik bulunamadı veya artık kullanılamıyor.";
    case 409:
      return "Etkinlik artık iptal edilebilir durumda değil. Listeyi yenileyip tekrar kontrol edin.";
    default:
      return "Etkinlik iptal edilemedi. Lütfen tekrar deneyin.";
  }
}

export function getSafeCompleteErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Etkinlik tamamlanamadı.";
    case 401:
      return "Oturumunuz sona ermiş. Tekrar giriş yapın.";
    case 403:
      return "Bu etkinliği tamamlama yetkiniz yok.";
    case 404:
      return "Etkinlik bulunamadı veya artık kullanılamıyor.";
    case 409:
      return "Etkinlik henüz tamamlanamaz veya artık uygun durumda değil.";
    default:
      return "Etkinlik tamamlanamadı. Lütfen tekrar deneyin.";
  }
}

import { getApiBaseUrl } from "@agu/config";

export function buildSubmitEventApiPath(eventId: string): string {
  return `${getApiBaseUrl()}/events/${encodeURIComponent(eventId)}/submit`;
}

export function canSubmitDraftEvent(status: string): boolean {
  return status === "DRAFT";
}

export function getSafeSubmitErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Etkinlik mevcut bilgileriyle incelemeye gönderilemedi.";
    case 401:
      return "Oturumunuz sona ermiş. Tekrar giriş yapın.";
    case 403:
      return "Bu etkinliği incelemeye gönderme yetkiniz yok.";
    case 404:
      return "Etkinlik bulunamadı veya artık kullanılamıyor.";
    case 409:
      return "Etkinlik artık taslak durumda değil. Listeyi yenileyip tekrar kontrol edin.";
    default:
      return "Etkinlik incelemeye gönderilemedi. Lütfen tekrar deneyin.";
  }
}

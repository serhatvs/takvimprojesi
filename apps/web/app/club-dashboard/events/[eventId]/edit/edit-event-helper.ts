import { getApiBaseUrl } from "@agu/config";

export function buildRevisionApiPath(eventId: string): string {
  return `${getApiBaseUrl()}/events/${encodeURIComponent(eventId)}/revision`;
}

export function buildSubmitApiPath(eventId: string): string {
  return `${getApiBaseUrl()}/events/${encodeURIComponent(eventId)}/submit`;
}

export function getSafeRevisionDetailErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Etkinlik bağlantısı geçersiz.";
    case 401:
      return "Oturumunuz sona ermiş. Tekrar giriş yapın.";
    case 403:
      return "Bu etkinliği düzenleme yetkiniz yok.";
    case 404:
      return "Etkinlik bulunamadı veya artık kullanılamıyor.";
    case 409:
      return "Etkinlik artık değişiklik bekleyen durumda değil.";
    default:
      return "Etkinlik bilgileri alınamadı. Lütfen tekrar deneyin.";
  }
}

export function getSafeRevisionUpdateErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Etkinlik bilgilerini kontrol edip tekrar deneyin.";
    case 401:
      return "Oturumunuz sona ermiş. Tekrar giriş yapın.";
    case 403:
      return "Bu etkinliği düzenleme yetkiniz yok.";
    case 404:
      return "Etkinlik bulunamadı veya artık kullanılamıyor.";
    case 409:
      return "Etkinlik artık değişiklik bekleyen durumda değil. Listeyi yenileyip tekrar kontrol edin.";
    default:
      return "Etkinlik değişiklikleri kaydedilemedi. Lütfen tekrar deneyin.";
  }
}

export function getSafeResubmitErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Etkinlik mevcut bilgileriyle yeniden incelemeye gönderilemedi.";
    case 401:
      return "Oturumunuz sona ermiş. Tekrar giriş yapın.";
    case 403:
      return "Bu etkinliği yeniden incelemeye gönderme yetkiniz yok.";
    case 404:
      return "Etkinlik bulunamadı veya artık kullanılamıyor.";
    case 409:
      return "Etkinlik artık yeniden gönderilebilir durumda değil. Listeyi yenileyip tekrar kontrol edin.";
    default:
      return "Etkinlik yeniden incelemeye gönderilemedi. Lütfen tekrar deneyin.";
  }
}

export function buildReturnDashboardHref(
  clubId: string,
  params?: { status?: string; q?: string; page?: string; pageSize?: string },
  notice?: string
): string {
  const searchParams = new URLSearchParams();
  if (clubId) searchParams.set("clubId", clubId);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.q) searchParams.set("q", params.q);
  if (params?.page) searchParams.set("page", params.page);
  if (params?.pageSize) searchParams.set("pageSize", params.pageSize);
  if (notice) searchParams.set("notice", notice);

  const qs = searchParams.toString();
  return `/club-dashboard${qs ? `?${qs}` : ""}`;
}

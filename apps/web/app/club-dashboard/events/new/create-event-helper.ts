export function parseLocalToIstanbulUtc(localDateTimeString: string): string {
  if (!localDateTimeString || typeof localDateTimeString !== "string") {
    return "";
  }

  const trimmed = localDateTimeString.trim();
  // Expect format like YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return "";
  }

  const formatted = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const dateWithOffset = new Date(`${formatted}.000+03:00`);

  if (Number.isNaN(dateWithOffset.getTime())) {
    return "";
  }

  return dateWithOffset.toISOString();
}

export function parseUtcToIstanbulLocal(isoString: string): string {
  if (!isoString || typeof isoString !== "string") {
    return "";
  }
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const istanbulDate = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  const year = istanbulDate.getUTCFullYear();
  const month = String(istanbulDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istanbulDate.getUTCDate()).padStart(2, "0");
  const hours = String(istanbulDate.getUTCHours()).padStart(2, "0");
  const minutes = String(istanbulDate.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function validateCapacity(capacityRaw: string): { valid: boolean; value?: number; error?: string } {
  if (!capacityRaw || capacityRaw.trim() === "") {
    return { valid: true };
  }

  const trimmed = capacityRaw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, error: "Kapasite pozitif bir tam sayı olmalıdır." };
  }

  const num = Number(trimmed);
  if (!Number.isInteger(num) || num <= 0) {
    return { valid: false, error: "Kapasite pozitif bir tam sayı olmalıdır." };
  }

  return { valid: true, value: num };
}

export function getSafeErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Etkinlik bilgilerini kontrol edip tekrar deneyin.";
    case 401:
      return "Oturumunuz sona ermiş. Tekrar giriş yapın.";
    case 403:
      return "Bu kulüp adına etkinlik oluşturma yetkiniz yok.";
    case 404:
      return "Seçilen kulüp bulunamadı veya artık kullanılamıyor.";
    default:
      return "Etkinlik oluşturulamadı. Lütfen tekrar deneyin.";
  }
}

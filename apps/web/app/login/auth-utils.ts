export function validateReturnTo(raw: string | null | undefined): string {
  if (typeof raw !== "string" || !raw) {
    return "/";
  }

  const trimmed = raw.trim();

  // Must start with '/' and must NOT start with '//' or '/\'
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return "/";
  }

  // Must not contain protocol schemes, colons or backslashes
  if (trimmed.includes(":") || trimmed.includes("\\")) {
    return "/";
  }

  return trimmed;
}

export function isValidEmailFormat(email: string): boolean {
  if (typeof email !== "string") {
    return false;
  }
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function cleanOtpCode(raw: string): string {
  if (typeof raw !== "string") {
    return "";
  }
  return raw.replace(/\D/g, "").slice(0, 6);
}

export function mapAuthApiError(
  status: number,
  responseBody?: { code?: string; message?: string } | null
): string {
  if (responseBody?.code === "DISPLAY_NAME_REQUIRED") {
    return "Yeni kullanıcılar için ad soyad zorunludur.";
  }

  switch (status) {
    case 400:
      return "E-posta veya kod biçimi geçersiz.";
    case 401:
      return "Kod geçersiz veya süresi dolmuş.";
    case 403:
      return "E-posta ile giriş sistemi devredışıdır.";
    case 409:
      return "Kod artık kullanılamıyor, lütfen yeni bir kod isteyin.";
    case 429:
      return "Çok fazla deneme yapıldı; lütfen daha sonra tekrar deneyin.";
    case 500:
    case 502:
    case 503:
      return "Kod gönderilemedi veya giriş tamamlanamadı. Lütfen daha sonra tekrar deneyin.";
    default:
      return "Sunucuya ulaşılamadı veya bir hata oluştu.";
  }
}

import { describe, expect, it } from "vitest";
import {
  cleanOtpCode,
  isValidEmailFormat,
  mapAuthApiError,
  validateReturnTo
} from "./auth-utils";

describe("auth-utils", () => {
  describe("validateReturnTo", () => {
    it("accepts valid relative paths", () => {
      expect(validateReturnTo("/")).toBe("/");
      expect(validateReturnTo("/events/123")).toBe("/events/123");
      expect(validateReturnTo("/attendance/check-in")).toBe("/attendance/check-in");
      expect(validateReturnTo("/club-dashboard?tab=events")).toBe("/club-dashboard?tab=events");
    });

    it("rejects absolute URLs, protocol schemes, and malformed paths", () => {
      expect(validateReturnTo("https://attacker.example")).toBe("/");
      expect(validateReturnTo("http://attacker.example")).toBe("/");
      expect(validateReturnTo("//attacker.example")).toBe("/");
      expect(validateReturnTo("/\\attacker.example")).toBe("/");
      expect(validateReturnTo("javascript:alert(1)")).toBe("/");
      expect(validateReturnTo("/javascript:alert(1)")).toBe("/");
      expect(validateReturnTo("data:text/html,...")).toBe("/");
      expect(validateReturnTo(null)).toBe("/");
      expect(validateReturnTo(undefined)).toBe("/");
      expect(validateReturnTo("")).toBe("/");
    });
  });

  describe("isValidEmailFormat", () => {
    it("validates emails correctly", () => {
      expect(isValidEmailFormat("student@agu.edu.tr")).toBe(true);
      expect(isValidEmailFormat("external@gmail.com")).toBe(true);
      expect(isValidEmailFormat("invalid")).toBe(false);
      expect(isValidEmailFormat("")).toBe(false);
    });
  });

  describe("cleanOtpCode", () => {
    it("strips non-digits and truncates to 6 characters", () => {
      expect(cleanOtpCode("123456")).toBe("123456");
      expect(cleanOtpCode("012345")).toBe("012345"); // Preserves leading zeros
      expect(cleanOtpCode("a1b2c3d4e5f6g7")).toBe("123456");
      expect(cleanOtpCode("123-456")).toBe("123456");
    });
  });

  describe("mapAuthApiError", () => {
    it("maps status codes to safe user messages", () => {
      expect(mapAuthApiError(400)).toBe("E-posta veya kod biçimi geçersiz.");
      expect(mapAuthApiError(401)).toBe("Kod geçersiz veya süresi dolmuş.");
      expect(mapAuthApiError(403)).toBe("E-posta ile giriş sistemi devredışıdır.");
      expect(mapAuthApiError(409)).toBe("Kod artık kullanılamıyor, lütfen yeni bir kod isteyin.");
      expect(mapAuthApiError(429)).toBe("Çok fazla deneme yapıldı; lütfen daha sonra tekrar deneyin.");
      expect(mapAuthApiError(500)).toBe("Kod gönderilemedi veya giriş tamamlanamadı. Lütfen daha sonra tekrar deneyin.");
      expect(mapAuthApiError(0)).toBe("Sunucuya ulaşılamadı veya bir hata oluştu.");
    });
  });
});

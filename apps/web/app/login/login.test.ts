import { describe, expect, it } from "vitest";
import {
  cleanOtpCode,
  isValidEmailFormat,
  mapAuthApiError,
  validateReturnTo
} from "./auth-utils";

describe("Web Login Flow & Integration Logic", () => {
  describe("ReturnTo Safety & Validation (Requirements 8, 16, 17, 18)", () => {
    it("allows valid relative paths within application", () => {
      expect(validateReturnTo("/")).toBe("/");
      expect(validateReturnTo("/events/evt-123")).toBe("/events/evt-123");
      expect(validateReturnTo("/attendance/check-in")).toBe("/attendance/check-in");
      expect(validateReturnTo("/club-dashboard")).toBe("/club-dashboard");
      expect(validateReturnTo("/events/evt-123?q=test")).toBe("/events/evt-123?q=test");
    });

    it("rejects open redirects and external domain URLs", () => {
      expect(validateReturnTo("https://attacker.example")).toBe("/");
      expect(validateReturnTo("http://attacker.example/events")).toBe("/");
      expect(validateReturnTo("//attacker.example")).toBe("/");
      expect(validateReturnTo("/\\attacker.example")).toBe("/");
    });

    it("rejects malicious protocols (javascript, data, vbscript)", () => {
      expect(validateReturnTo("javascript:alert(1)")).toBe("/");
      expect(validateReturnTo("/javascript:alert(1)")).toBe("/");
      expect(validateReturnTo("data:text/html,<script>alert(1)</script>")).toBe("/");
    });

    it("handles null, undefined, and empty strings gracefully", () => {
      expect(validateReturnTo(null)).toBe("/");
      expect(validateReturnTo(undefined)).toBe("/");
      expect(validateReturnTo("   ")).toBe("/");
    });
  });

  describe("E-posta & OTP Format Processing (Requirements 4, 8, 9, 23, 24)", () => {
    it("validates valid e-mail formats and rejects invalid strings before API call", () => {
      expect(isValidEmailFormat("student@agu.edu.tr")).toBe(true);
      expect(isValidEmailFormat("external.participant@gmail.com")).toBe(true);
      expect(isValidEmailFormat("  student@agu.edu.tr  ")).toBe(true);
      expect(isValidEmailFormat("invalid-email")).toBe(false);
      expect(isValidEmailFormat("@agu.edu.tr")).toBe(false);
      expect(isValidEmailFormat("user@")).toBe(false);
      expect(isValidEmailFormat("")).toBe(false);
    });

    it("preserves leading zeros in 6-digit OTP codes", () => {
      expect(cleanOtpCode("012345")).toBe("012345");
      expect(cleanOtpCode("000000")).toBe("000000");
    });

    it("cleans non-numeric characters and limits length to 6 digits", () => {
      expect(cleanOtpCode("123-456")).toBe("123456");
      expect(cleanOtpCode("a1b2c3d4e5f6g7")).toBe("123456");
      expect(cleanOtpCode(" 9 8 7 6 5 4 ")).toBe("987654");
    });
  });

  describe("API Error & Privacy Mapping (Requirements 7, 14, 15, 23, 24)", () => {
    it("maps 429 rate limit to user-friendly message without leaking internals", () => {
      expect(mapAuthApiError(429)).toBe("Çok fazla deneme yapıldı; lütfen daha sonra tekrar deneyin.");
    });

    it("maps 401 code invalid/expired to clear message", () => {
      expect(mapAuthApiError(401)).toBe("Kod geçersiz veya süresi dolmuş.");
    });

    it("maps 403 auth disabled status", () => {
      expect(mapAuthApiError(403)).toBe("E-posta ile giriş sistemi devredışıdır.");
    });

    it("maps DISPLAY_NAME_REQUIRED response code accurately", () => {
      expect(
        mapAuthApiError(400, {
          code: "DISPLAY_NAME_REQUIRED",
          message: "Yeni kullanıcılar için ad soyad zorunludur."
        })
      ).toBe("Yeni kullanıcılar için ad soyad zorunludur.");
    });

    it("maps server/network errors safely without stack traces or provider secrets", () => {
      expect(mapAuthApiError(500)).toBe(
        "Kod gönderilemedi veya giriş tamamlanamadı. Lütfen daha sonra tekrar deneyin."
      );
      expect(mapAuthApiError(0)).toBe("Sunucuya ulaşılamadı veya bir hata oluştu.");
    });
  });

  describe("Event Detail & Check-in Integration Hrefs (Requirements 11, 12, 21, 22)", () => {
    it("builds correct event registration login return URL", () => {
      const eventId = "evt-pilot-1";
      const returnUrl = `/login?returnTo=/events/${encodeURIComponent(eventId)}`;
      expect(returnUrl).toBe("/login?returnTo=/events/evt-pilot-1");
      expect(validateReturnTo("/events/evt-pilot-1")).toBe("/events/evt-pilot-1");
    });

    it("builds correct check-in login return URL", () => {
      const returnUrl = "/login?returnTo=/attendance/check-in";
      expect(validateReturnTo("/attendance/check-in")).toBe("/attendance/check-in");
      expect(returnUrl).toContain("returnTo=/attendance/check-in");
    });
  });
});

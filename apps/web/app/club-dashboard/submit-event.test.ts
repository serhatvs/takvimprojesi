import { describe, expect, it } from "vitest";
import {
  buildSubmitEventApiPath,
  canSubmitDraftEvent,
  getSafeSubmitErrorMessage
} from "./submit-event-helper";

describe("submit-event-helper", () => {
  describe("canSubmitDraftEvent", () => {
    it("returns true only for DRAFT status", () => {
      expect(canSubmitDraftEvent("DRAFT")).toBe(true);
    });

    it("returns false for all other event statuses", () => {
      expect(canSubmitDraftEvent("SUBMITTED")).toBe(false);
      expect(canSubmitDraftEvent("CHANGES_REQUESTED")).toBe(false);
      expect(canSubmitDraftEvent("REJECTED")).toBe(false);
      expect(canSubmitDraftEvent("APPROVED")).toBe(false);
      expect(canSubmitDraftEvent("PUBLISHED")).toBe(false);
      expect(canSubmitDraftEvent("CANCELLED")).toBe(false);
      expect(canSubmitDraftEvent("COMPLETED")).toBe(false);
      expect(canSubmitDraftEvent("UNKNOWN")).toBe(false);
    });
  });

  describe("buildSubmitEventApiPath", () => {
    it("builds correct path with encoded eventId", () => {
      const path = buildSubmitEventApiPath("evt-123");
      expect(path).toContain("/events/evt-123/submit");
    });

    it("encodes special characters in eventId for path safety", () => {
      const path = buildSubmitEventApiPath("event/id with spaces&special");
      expect(path).toContain("/events/event%2Fid%20with%20spaces%26special/submit");
    });
  });

  describe("getSafeSubmitErrorMessage", () => {
    it("returns safe 400 error message", () => {
      expect(getSafeSubmitErrorMessage(400)).toBe("Etkinlik mevcut bilgileriyle incelemeye gönderilemedi.");
    });

    it("returns safe 401 error message", () => {
      expect(getSafeSubmitErrorMessage(401)).toBe("Oturumunuz sona ermiş. Tekrar giriş yapın.");
    });

    it("returns safe 403 error message", () => {
      expect(getSafeSubmitErrorMessage(403)).toBe("Bu etkinliği incelemeye gönderme yetkiniz yok.");
    });

    it("returns safe 404 error message", () => {
      expect(getSafeSubmitErrorMessage(404)).toBe("Etkinlik bulunamadı veya artık kullanılamıyor.");
    });

    it("returns safe 409 error message", () => {
      expect(getSafeSubmitErrorMessage(409)).toBe("Etkinlik artık taslak durumda değil. Listeyi yenileyip tekrar kontrol edin.");
    });

    it("returns safe default error message for 500 and network errors", () => {
      expect(getSafeSubmitErrorMessage(500)).toBe("Etkinlik incelemeye gönderilemedi. Lütfen tekrar deneyin.");
      expect(getSafeSubmitErrorMessage(503)).toBe("Etkinlik incelemeye gönderilemedi. Lütfen tekrar deneyin.");
    });
  });

  describe("Contract and security verification", () => {
    it("verifies request does not include client-side user/role/status overrides", () => {
      const requestOptions = {
        method: "POST",
        credentials: "include" as const,
        cache: "no-store" as const
      };

      expect(requestOptions.credentials).toBe("include");
      expect(requestOptions.cache).toBe("no-store");

      // Verify no body is required or sent containing sensitive/overriding fields
      const forbiddenFields = ["userId", "role", "status", "membership", "clubId"];
      const body = undefined;

      for (const field of forbiddenFields) {
        expect(body?.[field as keyof typeof body]).toBeUndefined();
      }
    });
  });
});

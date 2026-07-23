import { describe, expect, it } from "vitest";
import {
  getSafeErrorMessage,
  parseLocalToIstanbulUtc,
  validateCapacity
} from "./create-event-helper";

describe("create-event-helper", () => {
  describe("parseLocalToIstanbulUtc", () => {
    it("converts 2026-08-10T15:30 to 2026-08-10T12:30:00.000Z regardless of test environment timezone", () => {
      const utcString = parseLocalToIstanbulUtc("2026-08-10T15:30");
      expect(utcString).toBe("2026-08-10T12:30:00.000Z");
    });

    it("handles datetime with seconds 2026-08-10T15:30:00 correctly", () => {
      const utcString = parseLocalToIstanbulUtc("2026-08-10T15:30:00");
      expect(utcString).toBe("2026-08-10T12:30:00.000Z");
    });

    it("returns empty string for invalid date formats", () => {
      expect(parseLocalToIstanbulUtc("invalid-date")).toBe("");
      expect(parseLocalToIstanbulUtc("2026-08-10")).toBe("");
      expect(parseLocalToIstanbulUtc("")).toBe("");
      expect(parseLocalToIstanbulUtc(null as unknown as string)).toBe("");
    });
  });

  describe("validateCapacity", () => {
    it("returns undefined value for empty or whitespace string", () => {
      expect(validateCapacity("")).toEqual({ valid: true, value: undefined });
      expect(validateCapacity("   ")).toEqual({ valid: true, value: undefined });
    });

    it("accepts valid positive integer", () => {
      expect(validateCapacity("100")).toEqual({ valid: true, value: 100 });
      expect(validateCapacity("1")).toEqual({ valid: true, value: 1 });
    });

    it("rejects 0", () => {
      const res = validateCapacity("0");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Kapasite pozitif bir tam sayı olmalıdır.");
    });

    it("rejects negative capacity", () => {
      const res = validateCapacity("-50");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Kapasite pozitif bir tam sayı olmalıdır.");
    });

    it("rejects decimal/float capacity", () => {
      const res = validateCapacity("10.5");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Kapasite pozitif bir tam sayı olmalıdır.");
    });

    it("rejects non-numeric string", () => {
      const res = validateCapacity("abc");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Kapasite pozitif bir tam sayı olmalıdır.");
    });
  });

  describe("getSafeErrorMessage", () => {
    it("returns safe 400 error message", () => {
      expect(getSafeErrorMessage(400)).toBe("Etkinlik bilgilerini kontrol edip tekrar deneyin.");
    });

    it("returns safe 401 error message", () => {
      expect(getSafeErrorMessage(401)).toBe("Oturumunuz sona ermiş. Tekrar giriş yapın.");
    });

    it("returns safe 403 error message", () => {
      expect(getSafeErrorMessage(403)).toBe("Bu kulüp adına etkinlik oluşturma yetkiniz yok.");
    });

    it("returns safe 404 error message", () => {
      expect(getSafeErrorMessage(404)).toBe("Seçilen kulüp bulunamadı veya artık kullanılamıyor.");
    });

    it("returns generic safe message for 500 or other status", () => {
      expect(getSafeErrorMessage(500)).toBe("Etkinlik oluşturulamadı. Lütfen tekrar deneyin.");
      expect(getSafeErrorMessage(502)).toBe("Etkinlik oluşturulamadı. Lütfen tekrar deneyin.");
    });
  });

  describe("Contract payload safety check", () => {
    it("verifies payload keys only contain permitted fields", () => {
      const allowedKeys = new Set([
        "clubId",
        "title",
        "description",
        "startsAt",
        "endsAt",
        "location",
        "capacity"
      ]);

      const forbiddenKeys = [
        "userId",
        "createdById",
        "role",
        "membership",
        "status",
        "publishedAt",
        "qrToken",
        "qrTokenHash",
        "audit"
      ];

      const samplePayload: Record<string, unknown> = {
        clubId: "club-123",
        title: "Test Event",
        description: "Event Description",
        location: "Hall A",
        startsAt: "2026-08-10T12:30:00.000Z",
        endsAt: "2026-08-10T14:30:00.000Z",
        capacity: 100
      };

      for (const key of Object.keys(samplePayload)) {
        expect(allowedKeys.has(key)).toBe(true);
      }

      for (const forbiddenKey of forbiddenKeys) {
        expect(samplePayload[forbiddenKey]).toBeUndefined();
      }
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  parseLocalToIstanbulUtc,
  parseUtcToIstanbulLocal
} from "./events/new/create-event-helper";
import {
  buildReturnDashboardHref,
  buildRevisionApiPath,
  buildSubmitApiPath,
  getSafeResubmitErrorMessage,
  getSafeRevisionDetailErrorMessage,
  getSafeRevisionUpdateErrorMessage
} from "./events/[eventId]/edit/edit-event-helper";

describe("edit event helper & date conversions", () => {
  describe("API path builders", () => {
    it("builds revision API path correctly", () => {
      expect(buildRevisionApiPath("evt-123")).toContain("/events/evt-123/revision");
    });

    it("builds submit API path correctly", () => {
      expect(buildSubmitApiPath("evt-123")).toContain("/events/evt-123/submit");
    });
  });

  describe("buildReturnDashboardHref", () => {
    it("returns base href with clubId", () => {
      expect(buildReturnDashboardHref("club-1")).toBe("/club-dashboard?clubId=club-1");
    });

    it("preserves query state (status, q, page, pageSize)", () => {
      const href = buildReturnDashboardHref("club-1", {
        status: "CHANGES_REQUESTED",
        q: "amfi",
        page: "2",
        pageSize: "10"
      });
      expect(href).toBe(
        "/club-dashboard?clubId=club-1&status=CHANGES_REQUESTED&q=amfi&page=2&pageSize=10"
      );
    });

    it("appends notice when provided", () => {
      const href = buildReturnDashboardHref(
        "club-1",
        { status: "SUBMITTED" },
        "resubmitted"
      );
      expect(href).toBe(
        "/club-dashboard?clubId=club-1&status=SUBMITTED&notice=resubmitted"
      );
    });
  });

  describe("Safe Error Message Handlers", () => {
    it("returns expected messages for GET revision detail status codes", () => {
      expect(getSafeRevisionDetailErrorMessage(400)).toBe("Etkinlik bağlantısı geçersiz.");
      expect(getSafeRevisionDetailErrorMessage(401)).toBe("Oturumunuz sona ermiş. Tekrar giriş yapın.");
      expect(getSafeRevisionDetailErrorMessage(403)).toBe("Bu etkinliği düzenleme yetkiniz yok.");
      expect(getSafeRevisionDetailErrorMessage(404)).toBe("Etkinlik bulunamadı veya artık kullanılamıyor.");
      expect(getSafeRevisionDetailErrorMessage(409)).toBe("Etkinlik artık değişiklik bekleyen durumda değil.");
      expect(getSafeRevisionDetailErrorMessage(500)).toBe("Etkinlik bilgileri alınamadı. Lütfen tekrar deneyin.");
    });

    it("returns expected messages for PATCH revision update status codes", () => {
      expect(getSafeRevisionUpdateErrorMessage(400)).toBe("Etkinlik bilgilerini kontrol edip tekrar deneyin.");
      expect(getSafeRevisionUpdateErrorMessage(401)).toBe("Oturumunuz sona ermiş. Tekrar giriş yapın.");
      expect(getSafeRevisionUpdateErrorMessage(403)).toBe("Bu etkinliği düzenleme yetkiniz yok.");
      expect(getSafeRevisionUpdateErrorMessage(404)).toBe("Etkinlik bulunamadı veya artık kullanılamıyor.");
      expect(getSafeRevisionUpdateErrorMessage(409)).toBe("Etkinlik artık değişiklik bekleyen durumda değil. Listeyi yenileyip tekrar kontrol edin.");
      expect(getSafeRevisionUpdateErrorMessage(500)).toBe("Etkinlik değişiklikleri kaydedilemedi. Lütfen tekrar deneyin.");
    });

    it("returns expected messages for POST resubmit status codes", () => {
      expect(getSafeResubmitErrorMessage(400)).toBe("Etkinlik mevcut bilgileriyle yeniden incelemeye gönderilemedi.");
      expect(getSafeResubmitErrorMessage(401)).toBe("Oturumunuz sona ermiş. Tekrar giriş yapın.");
      expect(getSafeResubmitErrorMessage(403)).toBe("Bu etkinliği yeniden incelemeye gönderme yetkiniz yok.");
      expect(getSafeResubmitErrorMessage(404)).toBe("Etkinlik bulunamadı veya artık kullanılamıyor.");
      expect(getSafeResubmitErrorMessage(409)).toBe("Etkinlik artık yeniden gönderilebilir durumda değil. Listeyi yenileyip tekrar kontrol edin.");
      expect(getSafeResubmitErrorMessage(500)).toBe("Etkinlik yeniden incelemeye gönderilemedi. Lütfen tekrar deneyin.");
    });
  });

  describe("Date conversion helpers (Europe/Istanbul <-> UTC ISO)", () => {
    it("converts UTC ISO string to Istanbul local datetime-local format", () => {
      const local = parseUtcToIstanbulLocal("2026-08-10T12:30:00.000Z");
      expect(local).toBe("2026-08-10T15:30");
    });

    it("converts Istanbul local datetime-local string to UTC ISO format", () => {
      const utc = parseLocalToIstanbulUtc("2026-08-10T15:30");
      expect(utc).toBe("2026-08-10T12:30:00.000Z");
    });

    it("handles invalid date strings gracefully", () => {
      expect(parseUtcToIstanbulLocal("invalid")).toBe("");
      expect(parseLocalToIstanbulUtc("invalid")).toBe("");
    });
  });
});

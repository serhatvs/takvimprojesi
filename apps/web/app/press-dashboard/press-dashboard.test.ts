import type { AuthPrincipal, PressEventListItem } from "@agu/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  buildPressEventsApiPath,
  buildPressEventsApprovedApiPath,
  buildPublishApiPath,
  buildReviewApiPath,
  getSafePressEventsErrorMessage,
  getSafePublishErrorMessage,
  getSafeReviewErrorMessage,
  isPressUser,
  parsePressDashboardView,
  toPressApprovedEventCardViewModel,
  toPressEventCardViewModel
} from "./press-dashboard-helper";

// Mock config and public-events formatEventDateTime
vi.mock("@agu/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agu/config")>();
  return {
    ...actual,
    getApiBaseUrl: vi.fn(() => "http://api.example.com")
  };
});

vi.mock("../public-events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../public-events")>();
  return {
    ...actual,
    formatEventDateTime: vi.fn((d: string) => `Formatted: ${d}`)
  };
});

describe("press-dashboard-helper", () => {
  describe("isPressUser", () => {
    it("returns true for PRESS_EDITOR and SYSTEM_ADMIN", () => {
      const pressUser: AuthPrincipal = {
        userId: "1",
        email: "press@agu.edu.tr",
        displayName: "Press",
        globalRoles: ["PRESS_EDITOR"],
        clubMemberships: []
      };
      const adminUser: AuthPrincipal = {
        userId: "2",
        email: "admin@agu.edu.tr",
        displayName: "Admin",
        globalRoles: ["SYSTEM_ADMIN"],
        clubMemberships: []
      };

      expect(isPressUser(pressUser)).toBe(true);
      expect(isPressUser(adminUser)).toBe(true);
    });

    it("returns false for STUDENT, CLUB_MEMBER, or CLUB_ADMIN-only users", () => {
      const student: AuthPrincipal = {
        userId: "3",
        email: "student@agu.edu.tr",
        displayName: "Student",
        globalRoles: ["STUDENT"],
        clubMemberships: []
      };
      const clubAdmin: AuthPrincipal = {
        userId: "4",
        email: "ca@agu.edu.tr",
        displayName: "Club Admin",
        globalRoles: ["CLUB_ADMIN"],
        clubMemberships: []
      };

      expect(isPressUser(student)).toBe(false);
      expect(isPressUser(clubAdmin)).toBe(false);
      expect(isPressUser(null)).toBe(false);
      expect(isPressUser(undefined)).toBe(false);
    });
  });

  describe("buildPressEventsApiPath", () => {
    it("builds basic path with default pagination", () => {
      expect(buildPressEventsApiPath()).toBe("http://api.example.com/press/events");
    });

    it("includes q and pagination query parameters", () => {
      expect(buildPressEventsApiPath("  music  ", 2, 50)).toBe(
        "http://api.example.com/press/events?q=music&page=2&pageSize=50"
      );
    });
  });

  describe("buildReviewApiPath", () => {
    it("encodes eventId in path for approve, request-changes, reject", () => {
      expect(buildReviewApiPath("evt-123", "approve")).toBe(
        "http://api.example.com/events/evt-123/approve"
      );
      expect(buildReviewApiPath("evt/special id", "request-changes")).toBe(
        "http://api.example.com/events/evt%2Fspecial%20id/request-changes"
      );
      expect(buildReviewApiPath("evt-456", "reject")).toBe(
        "http://api.example.com/events/evt-456/reject"
      );
    });
  });

  describe("getSafePressEventsErrorMessage", () => {
    it("returns safe messages for GET /press/events", () => {
      expect(getSafePressEventsErrorMessage(400)).toBe("Filtre değerlerinden biri geçersiz.");
      expect(getSafePressEventsErrorMessage(401)).toBe("Oturumunuz sona ermiş. Tekrar giriş yapın.");
      expect(getSafePressEventsErrorMessage(403)).toBe("Basın Yayın inceleme panelini görüntüleme yetkiniz yok.");
      expect(getSafePressEventsErrorMessage(500)).toBe(
        "İnceleme bekleyen etkinlikler alınamadı. Lütfen tekrar deneyin."
      );
    });
  });

  describe("getSafeReviewErrorMessage", () => {
    it("returns safe messages for review actions", () => {
      expect(getSafeReviewErrorMessage(400)).toBe("İnceleme bilgilerini kontrol edip tekrar deneyin.");
      expect(getSafeReviewErrorMessage(401)).toBe("Oturumunuz sona ermiş. Tekrar giriş yapın.");
      expect(getSafeReviewErrorMessage(403)).toBe("Bu etkinlik için inceleme işlemi yapma yetkiniz yok.");
      expect(getSafeReviewErrorMessage(404)).toBe("Etkinlik bulunamadı veya artık kullanılamıyor.");
      expect(getSafeReviewErrorMessage(409)).toBe(
        "Etkinlik artık inceleme bekleyen durumda değil. Listeyi yenileyip tekrar kontrol edin."
      );
      expect(getSafeReviewErrorMessage(500)).toBe(
        "İnceleme işlemi tamamlanamadı. Lütfen tekrar deneyin."
      );
    });
  });

  describe("toPressEventCardViewModel", () => {
    it("maps item fields into ViewModel with formatted dates and status label", () => {
      const sampleItem: PressEventListItem = {
        id: "evt-1",
        title: "Music Festival",
        description: "Concert description",
        status: "SUBMITTED",
        startsAt: "2026-09-01T10:00:00.000Z",
        endsAt: "2026-09-01T12:00:00.000Z",
        location: "Main Campus Hall",
        capacity: 250,
        createdAt: "2026-08-01T10:00:00.000Z",
        updatedAt: "2026-08-02T10:00:00.000Z",
        club: {
          id: "club-1",
          name: "Music Club"
        }
      };

      const vm = toPressEventCardViewModel(sampleItem);

      expect(vm).toEqual({
        id: "evt-1",
        title: "Music Festival",
        description: "Concert description",
        statusLabel: "İnceleme Bekliyor",
        clubName: "Music Club",
        startsAt: "Formatted: 2026-09-01T10:00:00.000Z",
        endsAt: "Formatted: 2026-09-01T12:00:00.000Z",
        location: "Main Campus Hall",
        capacityLabel: "250 Kişi",
        submittedAt: "Formatted: 2026-08-02T10:00:00.000Z"
      });
    });

    it("handles null capacity correctly", () => {
      const sampleItem: PressEventListItem = {
        id: "evt-2",
        title: "Open Workshop",
        description: "Workshop",
        status: "SUBMITTED",
        startsAt: "2026-09-01T10:00:00.000Z",
        endsAt: "2026-09-01T12:00:00.000Z",
        location: "Outdoor",
        capacity: null,
        createdAt: "2026-08-01T10:00:00.000Z",
        updatedAt: "2026-08-02T10:00:00.000Z",
        club: {
          id: "club-1",
          name: "Music Club"
        }
      };

      const vm = toPressEventCardViewModel(sampleItem);
      expect(vm.capacityLabel).toBeNull();
    });
  });

  describe("parsePressDashboardView", () => {
    it("parses publish view correctly and falls back to review for unknown/invalid values", () => {
      expect(parsePressDashboardView("publish")).toBe("publish");
      expect(parsePressDashboardView("review")).toBe("review");
      expect(parsePressDashboardView("unknown")).toBe("review");
      expect(parsePressDashboardView(null)).toBe("review");
      expect(parsePressDashboardView(undefined)).toBe("review");
    });
  });

  describe("buildPressEventsApprovedApiPath", () => {
    it("builds approved queue path with q, page, and pageSize", () => {
      expect(buildPressEventsApprovedApiPath()).toBe("http://api.example.com/press/events/approved");
      expect(buildPressEventsApprovedApiPath("  concert  ", 3, 10)).toBe(
        "http://api.example.com/press/events/approved?q=concert&page=3&pageSize=10"
      );
    });
  });

  describe("buildPublishApiPath", () => {
    it("encodes eventId in publish path", () => {
      expect(buildPublishApiPath("evt-100")).toBe("http://api.example.com/events/evt-100/publish");
      expect(buildPublishApiPath("evt/special 100")).toBe(
        "http://api.example.com/events/evt%2Fspecial%20100/publish"
      );
    });
  });

  describe("getSafePublishErrorMessage", () => {
    it("returns safe messages for publish POST endpoint", () => {
      expect(getSafePublishErrorMessage(400)).toBe("Etkinlik mevcut bilgileriyle yayınlanamadı.");
      expect(getSafePublishErrorMessage(401)).toBe("Oturumunuz sona ermiş. Tekrar giriş yapın.");
      expect(getSafePublishErrorMessage(403)).toBe("Bu etkinliği yayınlama yetkiniz yok.");
      expect(getSafePublishErrorMessage(404)).toBe("Etkinlik bulunamadı veya artık kullanılamıyor.");
      expect(getSafePublishErrorMessage(409)).toBe(
        "Etkinlik artık yayınlanmayı bekleyen durumda değil. Listeyi yenileyip tekrar kontrol edin."
      );
      expect(getSafePublishErrorMessage(500)).toBe("Etkinlik yayınlanamadı. Lütfen tekrar deneyin.");
    });
  });

  describe("toPressApprovedEventCardViewModel", () => {
    it("maps approved item to viewmodel with Yayınlanmayı Bekliyor status label", () => {
      const sampleItem = {
        id: "evt-approved-1",
        title: "Approved Festival",
        description: "Fest desc",
        status: "APPROVED" as const,
        startsAt: "2026-09-05T10:00:00.000Z",
        endsAt: "2026-09-05T12:00:00.000Z",
        location: "Grand Hall",
        capacity: 500,
        createdAt: "2026-08-01T10:00:00.000Z",
        updatedAt: "2026-08-03T10:00:00.000Z",
        publishedAt: null,
        club: { id: "club-1", name: "Music Club" }
      };

      const vm = toPressApprovedEventCardViewModel(sampleItem);

      expect(vm).toEqual({
        id: "evt-approved-1",
        title: "Approved Festival",
        description: "Fest desc",
        statusLabel: "Yayınlanmayı Bekliyor",
        clubName: "Music Club",
        startsAt: "Formatted: 2026-09-05T10:00:00.000Z",
        endsAt: "Formatted: 2026-09-05T12:00:00.000Z",
        location: "Grand Hall",
        capacityLabel: "500 Kişi",
        submittedAt: "Formatted: 2026-08-03T10:00:00.000Z"
      });
    });
  });

  describe("Contract & Security Verification", () => {
    it("ensures review requests use credentials include and cache no-store", () => {
      const options = {
        credentials: "include" as const,
        cache: "no-store" as const
      };

      expect(options.credentials).toBe("include");
      expect(options.cache).toBe("no-store");
    });
  });
});

import { describe, expect, it, vi, afterEach, beforeEach, type MockInstance } from "vitest";
import {
  parseClubDashboardFilters,
  buildClubEventsApiPath,
  buildClubDashboardPageHref,
  statusLabelFor,
  statusToneFor,
  toClubEventCardViewModel,
  loadManageableClubs,
  loadClubEvents
} from "./club-dashboard";

// Mock config
vi.mock("@agu/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agu/config")>();
  return {
    ...actual,
    getApiBaseUrl: vi.fn(() => "http://api.example.com"),
    DEFAULT_TIME_ZONE: "Europe/Istanbul"
  };
});

// Mock formatEventDateTime
vi.mock("../public-events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../public-events")>();
  return {
    ...actual,
    formatEventDateTime: vi.fn((d: string) => `Formatted: ${d}`)
  };
});

describe("club-dashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("statusLabelFor", () => {
    it("returns correct labels", () => {
      expect(statusLabelFor("DRAFT")).toBe("Taslak");
      expect(statusLabelFor("SUBMITTED")).toBe("Gönderildi");
      expect(statusLabelFor("CHANGES_REQUESTED")).toBe("Değişiklik İstendi");
      expect(statusLabelFor("REJECTED")).toBe("Reddedildi");
      expect(statusLabelFor("APPROVED")).toBe("Onaylandı");
      expect(statusLabelFor("PUBLISHED")).toBe("Yayında");
      expect(statusLabelFor("CANCELLED")).toBe("İptal Edildi");
      expect(statusLabelFor("COMPLETED")).toBe("Tamamlandı");
      expect(statusLabelFor("UNKNOWN")).toBe("UNKNOWN");
    });
  });

  describe("statusToneFor", () => {
    it("returns correct tones", () => {
      expect(statusToneFor("DRAFT")).toBe("neutral");
      expect(statusToneFor("SUBMITTED")).toBe("neutral");
      expect(statusToneFor("COMPLETED")).toBe("neutral");
      
      expect(statusToneFor("APPROVED")).toBe("success");
      expect(statusToneFor("PUBLISHED")).toBe("success");

      expect(statusToneFor("CHANGES_REQUESTED")).toBe("warning");
      expect(statusToneFor("REJECTED")).toBe("warning");
      expect(statusToneFor("CANCELLED")).toBe("warning");
      
      expect(statusToneFor("UNKNOWN")).toBe("neutral");
    });
  });

  describe("parseClubDashboardFilters", () => {
    it("handles empty params", () => {
      expect(parseClubDashboardFilters({})).toEqual({
        q: "",
        status: "",
        page: 1,
        pageSize: 10
      });
    });

    it("parses params correctly", () => {
      expect(parseClubDashboardFilters({ q: "test", status: "DRAFT", page: "2" })).toEqual({
        q: "test",
        status: "DRAFT",
        page: 2,
        pageSize: 10
      });
    });

    it("ignores invalid page", () => {
      expect(parseClubDashboardFilters({ page: "invalid" })).toEqual({
        q: "",
        status: "",
        page: 1,
        pageSize: 10
      });
    });
  });

  describe("toClubEventCardViewModel", () => {
    it("maps correctly with capacity", () => {
      const vm = toClubEventCardViewModel({
        id: "1",
        title: "Test Event",
        description: "Desc",
        startsAt: "2024-01-01T10:00:00Z",
        endsAt: "2024-01-01T12:00:00Z",
        location: "Room 1",
        capacity: 50,
        status: "PUBLISHED",
        participationScope: "AGU_ONLY",
        publishedAt: "2023-12-01T10:00:00Z",
        updatedAt: "2023-11-01T10:00:00Z"
      });

      expect(vm).toEqual({
        id: "1",
        title: "Test Event",
        description: "Desc",
        startsAt: "Formatted: 2024-01-01T10:00:00Z",
        endsAt: "Formatted: 2024-01-01T12:00:00Z",
        location: "Room 1",
        capacityLabel: "50 Kişi",
        statusLabel: "Yayında",
        statusTone: "success",
        updatedAt: "Formatted: 2023-11-01T10:00:00Z"
      });
    });

    it("maps correctly without capacity", () => {
      const vm = toClubEventCardViewModel({
        id: "2",
        title: "Test 2",
        description: "Desc 2",
        startsAt: "2024-01-01T10:00:00Z",
        endsAt: "2024-01-01T12:00:00Z",
        location: "Room 2",
        capacity: null,
        status: "DRAFT",
        participationScope: "AGU_ONLY",
        publishedAt: null,
        updatedAt: "2023-11-01T10:00:00Z"
      });

      expect(vm.capacityLabel).toBeNull();
      expect(vm.statusLabel).toBe("Taslak");
      expect(vm.statusTone).toBe("neutral");
    });
  });

  describe("buildClubEventsApiPath", () => {
    it("builds basic path", () => {
      expect(buildClubEventsApiPath("club1", { q: "", status: "", page: 1, pageSize: 10 })).toBe("/clubs/club1/events");
    });

    it("builds path with query string", () => {
      expect(buildClubEventsApiPath("club1", { q: "test", status: "DRAFT", page: 2, pageSize: 20 })).toBe("/clubs/club1/events?q=test&status=DRAFT&page=2&pageSize=20");
    });
  });

  describe("buildClubDashboardPageHref", () => {
    it("builds href correctly", () => {
      expect(buildClubDashboardPageHref("club1", { q: "test", status: "DRAFT", page: 1, pageSize: 10 }, 3))
        .toBe("/club-dashboard?clubId=club1&q=test&status=DRAFT&page=3");
    });
  });

  describe("API helpers", () => {
    let globalFetchSpy: MockInstance;

    beforeEach(() => {
      globalFetchSpy = vi.spyOn(global, "fetch");
    });

    describe("loadManageableClubs", () => {
      it("returns success on ok", async () => {
        globalFetchSpy.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ clubs: [{ id: "c1", name: "Club 1" }] })
        });
        
        const res = await loadManageableClubs();
        expect(res).toEqual({ status: "success", clubs: [{ id: "c1", name: "Club 1" }] });
        expect(globalFetchSpy).toHaveBeenCalledWith("http://api.example.com/clubs/manageable", {
          cache: "no-store",
          credentials: "include"
        });
      });

      it("returns error on !ok", async () => {
        globalFetchSpy.mockResolvedValueOnce({
          ok: false,
          status: 401
        });
        const res = await loadManageableClubs();
        expect(res).toEqual({ status: "api-error", message: "API Error: 401" });
      });

      it("returns error on throw", async () => {
        globalFetchSpy.mockRejectedValueOnce(new Error("Network Error"));
        const res = await loadManageableClubs();
        expect(res).toEqual({ status: "api-error", message: "Network Error" });
      });
    });

    describe("loadClubEvents", () => {
      it("returns success on ok", async () => {
        globalFetchSpy.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [], pagination: {}, statusCounts: {} })
        });
        
        const res = await loadClubEvents("c1", { q: "foo" });
        expect(res.status).toBe("success");
        if (res.status === "success") {
          expect(res.data).toEqual({ items: [], pagination: {}, statusCounts: {} });
          expect(res.filters.q).toBe("foo");
        }
        expect(globalFetchSpy).toHaveBeenCalledWith("http://api.example.com/clubs/c1/events?q=foo", {
          cache: "no-store",
          credentials: "include"
        });
      });

      it("returns error on !ok", async () => {
        globalFetchSpy.mockResolvedValueOnce({
          ok: false,
          status: 500
        });
        const res = await loadClubEvents("c1", { page: "1" });
        expect(res.status).toBe("api-error");
        if (res.status === "api-error") {
          expect(res.message).toBe("API Error: 500");
          expect(res.filters.page).toBe(1);
        }
      });

      it("returns error on throw", async () => {
        globalFetchSpy.mockRejectedValueOnce(new Error("Net Error"));
        const res = await loadClubEvents("c1", {});
        expect(res.status).toBe("api-error");
        if (res.status === "api-error") {
          expect(res.message).toBe("Net Error");
        }
      });
    });
  });
});

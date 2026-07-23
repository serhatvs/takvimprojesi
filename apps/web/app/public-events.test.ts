import type { AuthPrincipal, PublicEventDetailResponse, PublicEventListItem } from "@agu/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRegistrationStatusPath,
  buildRegistrationSubmitPath,
  hasStudentRole,
  messageForRegistrationConflict,
  stateFromRegistrationStatus,
  viewForRegistrationState
} from "./event-registration";
import {
  buildPublicEventDetailHref,
  buildPublicEventsApiPath,
  buildPublicEventsPageHref,
  buildPublicEventsReturnHref,
  createEventMetadataDescription,
  formatEventDateTime,
  loadPublicEventDetail,
  parsePublicEventFilters,
  toEventCardViewModel,
  toEventDetailViewModel
} from "./public-events";

const publicEvent: PublicEventListItem = {
  id: "event-1",
  title: "Robotik Atolyesi",
  description: "Kulup tanitim ve uygulama etkinligi.",
  startsAt: "2026-08-10T11:00:00.000Z",
  endsAt: "2026-08-10T13:00:00.000Z",
  location: "AGU Buyuk Amfi",
  capacity: 100,
  status: "PUBLISHED",
  publishedAt: "2026-07-23T12:00:00.000Z",
  club: {
    id: "club-1",
    name: "AGU Yazilim Kulubu",
    slug: "agu-yazilim-kulubu"
  }
};

const detailEvent: PublicEventDetailResponse = publicEvent;
const studentPrincipal: AuthPrincipal = {
  userId: "student-id",
  email: "student.dev@agu.edu.tr",
  displayName: "Student",
  globalRoles: ["STUDENT"],
  clubMemberships: []
};

const pressPrincipal: AuthPrincipal = {
  userId: "press-id",
  email: "press.dev@agu.edu.tr",
  displayName: "Press",
  globalRoles: ["PRESS_EDITOR"],
  clubMemberships: []
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("public event helpers", () => {
  it("maps a public event response to card data", () => {
    expect(toEventCardViewModel(publicEvent)).toMatchObject({
      id: "event-1",
      title: "Robotik Atolyesi",
      clubName: "AGU Yazilim Kulubu",
      location: "AGU Buyuk Amfi",
      capacityLabel: "100 kisilik kapasite",
      statusLabel: "Yayında"
    });
  });

  it("does not expose internal fields in card data", () => {
    const eventWithInternalFields = {
      ...publicEvent,
      createdById: "internal-user",
      qrTokenHash: "internal-token",
      auditLogs: []
    };

    const card = toEventCardViewModel(eventWithInternalFields);

    expect(card).not.toHaveProperty("createdById");
    expect(card).not.toHaveProperty("qrTokenHash");
    expect(card).not.toHaveProperty("auditLogs");
  });

  it("passes query parameters to the API request", () => {
    const filters = parsePublicEventFilters({
      q: "  robotik  ",
      from: "2026-08-10",
      to: "2026-08-12",
      page: "3"
    });

    const result = buildPublicEventsApiPath(filters);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.apiPath).toContain("q=robotik");
      expect(result.apiPath).toContain("page=3");
      expect(result.apiPath).toContain("pageSize=12");
      expect(result.apiPath).toContain("from=2026-08-09T21%3A00%3A00.000Z");
      expect(result.apiPath).toContain("to=2026-08-12T20%3A59%3A59.999Z");
    }
  });

  it("blocks an invalid date range before calling the API", () => {
    const result = buildPublicEventsApiPath({
      q: "",
      from: "2026-08-12",
      to: "2026-08-10",
      page: 1,
      pageSize: 12
    });

    expect(result.ok).toBe(false);
  });

  it("keeps filters in pagination links", () => {
    expect(
      buildPublicEventsPageHref(
        {
          q: "robotik",
          from: "2026-08-10",
          to: "2026-08-12",
          page: 2,
          pageSize: 12
        },
        3
      )
    ).toBe("/?q=robotik&from=2026-08-10&to=2026-08-12&page=3");
  });

  it("builds a detail URL for list cards", () => {
    expect(
      buildPublicEventDetailHref("event-1", {
        q: "",
        from: "",
        to: "",
        page: 1,
        pageSize: 12
      })
    ).toBe("/events/event-1?pageSize=12");
  });

  it("carries list filters into detail links", () => {
    expect(
      buildPublicEventDetailHref("event 1/unsafe", {
        q: "robotik",
        from: "2026-08-10",
        to: "2026-08-12",
        page: 2,
        pageSize: 12
      })
    ).toBe("/events/event%201%2Funsafe?q=robotik&from=2026-08-10&to=2026-08-12&page=2&pageSize=12");
  });

  it("keeps supported filters in the return link", () => {
    expect(
      buildPublicEventsReturnHref({
        q: "robotik",
        from: "2026-08-10",
        to: "2026-08-12",
        page: "2",
        pageSize: "100",
        unexpected: "ignored"
      })
    ).toBe("/?q=robotik&from=2026-08-10&to=2026-08-12&page=2&pageSize=100");
  });

  it("omits page from pagination links when returning to page one", () => {
    expect(
      buildPublicEventsPageHref(
        {
          q: "robotik",
          from: "",
          to: "",
          page: 2,
          pageSize: 12
        },
        1
      )
    ).toBe("/?q=robotik");
  });

  it("formats dates in Europe/Istanbul Turkish output", () => {
    expect(formatEventDateTime("2026-08-10T11:00:00.000Z")).toBe(
      "10 Ağustos 2026 Pazartesi 14:00"
    );
  });

  it("maps a public detail response to detail data", () => {
    expect(toEventDetailViewModel(detailEvent)).toMatchObject({
      id: "event-1",
      title: "Robotik Atolyesi",
      clubName: "AGU Yazilim Kulubu",
      location: "AGU Buyuk Amfi",
      capacityLabel: "100 kisilik kapasite",
      publishedAtLabel: "23 Temmuz 2026 Perşembe 15:00",
      statusLabel: "Yayında"
    });
  });

  it("does not expose internal fields in detail data", () => {
    const eventWithInternalFields = {
      ...detailEvent,
      createdById: "internal-user",
      reviewRecords: [],
      auditLogs: [],
      qrTokenHash: "internal-token"
    };

    const detail = toEventDetailViewModel(eventWithInternalFields);

    expect(detail).not.toHaveProperty("createdById");
    expect(detail).not.toHaveProperty("reviewRecords");
    expect(detail).not.toHaveProperty("auditLogs");
    expect(detail).not.toHaveProperty("qrTokenHash");
  });

  it("hides capacity when capacity is null", () => {
    expect(toEventDetailViewModel({ ...detailEvent, capacity: null }).capacityLabel).toBeNull();
  });

  it("turns API 404 into not-found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not found", { status: 404 }))
    );

    await expect(loadPublicEventDetail("event-1")).resolves.toEqual({ status: "not-found" });
  });

  it("does not turn API 5xx into not-found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Server error", { status: 500 }))
    );

    await expect(loadPublicEventDetail("event-1")).resolves.toMatchObject({
      status: "api-error"
    });
  });

  it("does not turn connection errors into not-found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection failed");
      })
    );

    await expect(loadPublicEventDetail("event-1")).resolves.toMatchObject({
      status: "api-error"
    });
  });

  it("encodes event IDs in detail API fetches", async () => {
    const fetchMock = vi.fn(async () => Response.json(detailEvent));
    vi.stubGlobal("fetch", fetchMock);

    await loadPublicEventDetail("event 1/unsafe");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/events/event%201%2Funsafe",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("creates metadata title and description values", () => {
    expect(detailEvent.title).toBe("Robotik Atolyesi");
    expect(createEventMetadataDescription("  Kisa   aciklama  ")).toBe("Kisa aciklama");
  });

  it("truncates long metadata descriptions safely", () => {
    const description = createEventMetadataDescription("a".repeat(180));

    expect(description).toHaveLength(155);
    expect(description.endsWith("…")).toBe(true);
  });

  it("detects student access for registration controls", () => {
    expect(hasStudentRole(studentPrincipal)).toBe(true);
    expect(hasStudentRole(pressPrincipal)).toBe(false);
  });

  it("shows the anonymous registration state without a join button", () => {
    expect(viewForRegistrationState({ kind: "anonymous" })).toMatchObject({
      message: "Katılmak için öğrenci hesabıyla giriş yapmalısınız.",
      showJoinButton: false
    });
  });

  it("does not show a join button for users without student access", () => {
    expect(viewForRegistrationState({ kind: "forbidden" })).toMatchObject({
      showJoinButton: false,
      message: "Bu etkinliğe kayıt olmak için öğrenci rolü gerekir."
    });
  });

  it("shows the join button for students without a registration", () => {
    const state = stateFromRegistrationStatus({
      registered: false,
      registration: null
    });

    expect(viewForRegistrationState(state)).toMatchObject({
      showJoinButton: true,
      buttonDisabled: false
    });
  });

  it("does not show the join button for registered students", () => {
    const state = stateFromRegistrationStatus({
      registered: true,
      registration: {
        id: "registration-id",
        eventId: "event-1",
        userId: "student-id",
        registeredAt: "2026-07-23T12:00:00.000Z"
      }
    });

    expect(viewForRegistrationState(state)).toMatchObject({
      message: "Bu etkinliğe kayıtlısınız.",
      showJoinButton: false,
      registeredAtLabel: "23 Temmuz 2026 Perşembe 15:00"
    });
  });

  it("builds registration endpoints with encoded event IDs", () => {
    expect(buildRegistrationStatusPath("event 1/unsafe")).toBe(
      "/events/event%201%2Funsafe/registration"
    );
    expect(buildRegistrationSubmitPath("event 1/unsafe")).toBe(
      "/events/event%201%2Funsafe/register"
    );
  });

  it("disables the join button while a registration request is pending", () => {
    expect(viewForRegistrationState({ kind: "submitting" })).toMatchObject({
      showJoinButton: true,
      buttonDisabled: true
    });
  });

  it("maps registration conflicts to safe messages", () => {
    expect(messageForRegistrationConflict("User is already registered for this event.")).toBe(
      "Bu etkinliğe zaten kayıtlısınız."
    );
    expect(messageForRegistrationConflict("Event capacity is full.")).toBe(
      "Etkinlik kapasitesi dolu."
    );
    expect(messageForRegistrationConflict("Registration is closed for started events.")).toBe(
      "Etkinlik başladığı için kayıt yapılamıyor."
    );
  });

  it("keeps network registration errors controlled", () => {
    expect(viewForRegistrationState({ kind: "error", message: "API bağlantısı kurulamadı." })).toMatchObject({
      showJoinButton: false,
      message: "API bağlantısı kurulamadı."
    });
  });
});

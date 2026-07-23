import type { AuthPrincipal, PublicEventDetailResponse, PublicEventListItem } from "@agu/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAttendanceTokenPath,
  canManageAttendanceQr,
  createAttendanceQrPayload,
  formatRemainingTime,
  messageForAttendanceQrError,
  secondsUntilExpiry,
  viewForAttendanceQrState
} from "./attendance-qr";
import {
  INVALID_QR_MESSAGE,
  buildCheckInSubmitPath,
  hasCheckInAccess,
  messageForCheckInResponse,
  parseCheckInQrPayload,
  shouldAcceptScan,
  stateAfterSuccessfulCheckIn,
  stopQrScannerSafely,
  viewForCheckInState
} from "./check-in";
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

const clubAdminPrincipal: AuthPrincipal = {
  userId: "club-admin-id",
  email: "club.admin.dev@agu.edu.tr",
  displayName: "Club Admin",
  globalRoles: ["CLUB_ADMIN"],
  clubMemberships: [
    {
      clubId: "club-1",
      clubSlug: "agu-yazilim-kulubu",
      clubName: "AGU Yazilim Kulubu",
      role: "ADMIN"
    }
  ]
};

const otherClubAdminPrincipal: AuthPrincipal = {
  ...clubAdminPrincipal,
  userId: "other-club-admin-id",
  clubMemberships: [
    {
      clubId: "club-2",
      clubSlug: "baska-kulup",
      clubName: "Baska Kulup",
      role: "ADMIN"
    }
  ]
};

const clubMemberPrincipal: AuthPrincipal = {
  ...clubAdminPrincipal,
  userId: "club-member-id",
  clubMemberships: [
    {
      clubId: "club-1",
      clubSlug: "agu-yazilim-kulubu",
      clubName: "AGU Yazilim Kulubu",
      role: "MEMBER"
    }
  ]
};

const systemAdminPrincipal: AuthPrincipal = {
  userId: "system-admin-id",
  email: "system.admin.dev@agu.edu.tr",
  displayName: "System Admin",
  globalRoles: ["SYSTEM_ADMIN"],
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
      showCheckInLink: true,
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

  it("allows the event club admin and system admin to see attendance QR controls", () => {
    expect(canManageAttendanceQr(clubAdminPrincipal, "club-1")).toBe(true);
    expect(canManageAttendanceQr(systemAdminPrincipal, "club-1")).toBe(true);
  });

  it("hides attendance QR controls from other roles and other club admins", () => {
    expect(canManageAttendanceQr(otherClubAdminPrincipal, "club-1")).toBe(false);
    expect(canManageAttendanceQr(clubMemberPrincipal, "club-1")).toBe(false);
    expect(canManageAttendanceQr(pressPrincipal, "club-1")).toBe(false);
    expect(canManageAttendanceQr(studentPrincipal, "club-1")).toBe(false);
  });

  it("creates a versioned attendance QR payload", () => {
    expect(JSON.parse(createAttendanceQrPayload("event-1", "token-1"))).toEqual({
      version: 1,
      eventId: "event-1",
      token: "token-1"
    });
  });

  it("keeps attendance token out of endpoint URLs and browser storage", () => {
    const token = "secret-token";
    const path = buildAttendanceTokenPath("event 1/unsafe");

    createAttendanceQrPayload("event 1/unsafe", token);

    expect(path).toBe("/events/event%201%2Funsafe/attendance-token");
    expect(path).not.toContain(token);
  });

  it("disables attendance QR creation while a request is pending", () => {
    expect(viewForAttendanceQrState({ kind: "issuing" })).toMatchObject({
      visible: true,
      showGenerateButton: true,
      buttonDisabled: true
    });
  });

  it("shows QR expiry and remaining time after a successful response", () => {
    expect(
      viewForAttendanceQrState({
        kind: "ready",
        tokenResponse: {
          eventId: "event-1",
          token: "token-1",
          expiresAt: "2026-07-23T12:15:00.000Z"
        },
        remainingSeconds: 872
      })
    ).toMatchObject({
      visible: true,
      showQr: true,
      buttonLabel: "QR’ı Yenile",
      expiryLabel: "23 Temmuz 2026 Perşembe 15:15",
      remainingLabel: "14 dakika 32 saniye kaldı"
    });
  });

  it("uses the latest attendance token response when QR is refreshed", () => {
    const firstPayload = createAttendanceQrPayload("event-1", "token-1");
    const refreshedPayload = createAttendanceQrPayload("event-1", "token-2");

    expect(firstPayload).not.toBe(refreshedPayload);
    expect(JSON.parse(refreshedPayload)).toMatchObject({ token: "token-2" });
  });

  it("moves the attendance QR into an expired state without showing a QR", () => {
    expect(viewForAttendanceQrState({ kind: "expired" })).toMatchObject({
      visible: true,
      message: "QR’ın süresi doldu.",
      showQr: false,
      showGenerateButton: true,
      buttonDisabled: false
    });
  });

  it("maps attendance QR errors to controlled messages", () => {
    expect(messageForAttendanceQrError(401)).toBe("Oturumunuz sona ermiş. Tekrar giriş yapın.");
    expect(messageForAttendanceQrError(403)).toBe(
      "Bu etkinlik için yoklama QR’ı oluşturma yetkiniz yok."
    );
    expect(messageForAttendanceQrError(404)).toBe(
      "Etkinlik bulunamadı veya artık kullanılamıyor."
    );
    expect(messageForAttendanceQrError(409)).toBe(
      "Yoklama QR’ı yalnızca yayınlanmış etkinlikler için oluşturulabilir."
    );
    expect(messageForAttendanceQrError(500)).toBe("QR oluşturulamadı. Lütfen tekrar deneyin.");
  });

  it("does not put attendance tokens in visible view labels", () => {
    const view = viewForAttendanceQrState({
      kind: "ready",
      tokenResponse: {
        eventId: "event-1",
        token: "plain-token",
        expiresAt: "2026-07-23T12:15:00.000Z"
      },
      remainingSeconds: 60
    });

    expect(JSON.stringify(view)).not.toContain("plain-token");
  });

  it("calculates attendance QR remaining time from expiry", () => {
    expect(
      secondsUntilExpiry(
        "2026-07-23T12:15:00.000Z",
        new Date("2026-07-23T12:00:28.000Z")
      )
    ).toBe(872);
    expect(formatRemainingTime(0)).toBe("0 saniye kaldı");
  });

  it("parses a valid version 1 check-in QR payload", () => {
    expect(parseCheckInQrPayload('{"version":1,"eventId":"event-1","token":"token-1"}')).toEqual({
      ok: true,
      eventId: "event-1",
      token: "token-1"
    });
  });

  it("rejects invalid check-in QR JSON", () => {
    expect(parseCheckInQrPayload("not-json")).toEqual({
      ok: false,
      message: INVALID_QR_MESSAGE
    });
  });

  it("rejects unsupported check-in QR versions", () => {
    expect(parseCheckInQrPayload('{"version":2,"eventId":"event-1","token":"token-1"}')).toEqual({
      ok: false,
      message: INVALID_QR_MESSAGE
    });
  });

  it("rejects check-in QR payloads without an event ID", () => {
    expect(parseCheckInQrPayload('{"version":1,"eventId":"","token":"token-1"}')).toEqual({
      ok: false,
      message: INVALID_QR_MESSAGE
    });
  });

  it("rejects check-in QR payloads without a token", () => {
    expect(parseCheckInQrPayload('{"version":1,"eventId":"event-1","token":"  "}')).toEqual({
      ok: false,
      message: INVALID_QR_MESSAGE
    });
  });

  it("does not allow non-students to start check-in scanning", () => {
    expect(hasCheckInAccess(studentPrincipal)).toBe(true);
    expect(hasCheckInAccess(pressPrincipal)).toBe(false);
    expect(viewForCheckInState({ kind: "forbidden" })).toMatchObject({
      canStartCamera: false,
      message: "Bu ekranı kullanmak için öğrenci rolü gerekir."
    });
  });

  it("shows a login message when check-in has no session", () => {
    expect(viewForCheckInState({ kind: "anonymous" })).toMatchObject({
      canStartCamera: false,
      message: "Yoklama vermek için öğrenci hesabıyla giriş yapmalısınız."
    });
  });

  it("shows a controlled camera permission error", () => {
    expect(
      viewForCheckInState({
        kind: "camera-error",
        message: "Kamera başlatılamadı. İzinleri kontrol edin veya manuel girişi kullanın.",
        manualOpen: true
      })
    ).toMatchObject({
      canStartCamera: true,
      manualOpen: true
    });
  });

  it("builds encoded check-in submit endpoints", () => {
    expect(buildCheckInSubmitPath("event 1/unsafe")).toBe(
      "/events/event%201%2Funsafe/check-in"
    );
  });

  it("ignores a second scan while check-in is submitting", () => {
    expect(shouldAcceptScan({ kind: "ready", cameraActive: true, manualOpen: false, message: null })).toBe(true);
    expect(shouldAcceptScan({ kind: "submitting" })).toBe(false);
  });

  it("clears sensitive payload state after successful check-in", () => {
    const state = stateAfterSuccessfulCheckIn({
      id: "attendance-id",
      eventId: "event-1",
      userId: "student-id",
      checkedInAt: "2026-07-23T12:00:00.000Z"
    });

    expect(state).toMatchObject({ kind: "success" });
    expect(JSON.stringify(state)).not.toContain("token-1");
    expect(viewForCheckInState(state)).toMatchObject({
      message: "Yoklamanız başarıyla alındı.",
      successCheckedInAtLabel: "23 Temmuz 2026 Perşembe 15:00"
    });
  });

  it("stops and clears the QR scanner on cleanup", async () => {
    const scanner = {
      stop: vi.fn(async () => undefined),
      clear: vi.fn()
    };

    await stopQrScannerSafely(scanner);

    expect(scanner.stop).toHaveBeenCalledOnce();
    expect(scanner.clear).toHaveBeenCalledOnce();
  });

  it("uses the same parser flow for manual check-in payloads", () => {
    const manualPayload = '{"version":1,"eventId":"event-1","token":"token-1"}';
    const parsed = parseCheckInQrPayload(manualPayload);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(buildCheckInSubmitPath(parsed.eventId)).toBe("/events/event-1/check-in");
    }
  });

  it("keeps manual check-in state clean after submission starts", () => {
    expect(viewForCheckInState({ kind: "submitting" })).toMatchObject({
      manualOpen: false,
      canSubmitManual: false,
      isSubmitting: true
    });
  });

  it("maps check-in API failures to safe messages", () => {
    expect(messageForCheckInResponse(400)).toBe("QR kod geçersiz veya süresi dolmuş.");
    expect(messageForCheckInResponse(401)).toBe("Oturumunuz sona ermiş. Tekrar giriş yapın.");
    expect(messageForCheckInResponse(403)).toBe(
      "Bu etkinlik için yoklama verme yetkiniz veya kaydınız bulunmuyor."
    );
    expect(messageForCheckInResponse(404)).toBe(
      "Etkinlik bulunamadı veya artık kullanılamıyor."
    );
    expect(messageForCheckInResponse(409)).toBe(
      "Yoklama zamanı uygun değil veya yoklamanız daha önce alınmış."
    );
    expect(messageForCheckInResponse(500)).toBe(
      "Yoklama gönderilemedi. Lütfen tekrar deneyin."
    );
  });

  it("does not put check-in tokens in view text, URLs, or storage helpers", () => {
    const token = "plain-token";
    const parsed = parseCheckInQrPayload(
      JSON.stringify({ version: 1, eventId: "event-1", token })
    );

    expect(parsed.ok).toBe(true);
    expect(buildCheckInSubmitPath("event-1")).not.toContain(token);
    expect(JSON.stringify(viewForCheckInState({ kind: "submitting" }))).not.toContain(token);
  });
});

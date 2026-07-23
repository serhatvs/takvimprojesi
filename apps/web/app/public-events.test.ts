import type { PublicEventListItem } from "@agu/contracts";
import { describe, expect, it } from "vitest";
import {
  buildPublicEventsApiPath,
  buildPublicEventsPageHref,
  formatEventDateTime,
  parsePublicEventFilters,
  toEventCardViewModel
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

describe("public event helpers", () => {
  it("maps a public event response to card data", () => {
    expect(toEventCardViewModel(publicEvent)).toMatchObject({
      id: "event-1",
      title: "Robotik Atolyesi",
      clubName: "AGU Yazilim Kulubu",
      location: "AGU Buyuk Amfi",
      capacityLabel: "100 kisilik kapasite",
      statusLabel: "Yayinda"
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
      page: 1
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
          page: 2
        },
        3
      )
    ).toBe("/?q=robotik&from=2026-08-10&to=2026-08-12&page=3");
  });

  it("omits page from pagination links when returning to page one", () => {
    expect(
      buildPublicEventsPageHref(
        {
          q: "robotik",
          from: "",
          to: "",
          page: 2
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
});

import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { Principal } from "../auth/principal";
import { EventsService } from "./events.service";

const clubAdmin: Principal = {
  userId: "club-admin-id",
  email: "club.admin.dev@agu.edu.tr",
  displayName: "Club Admin",
  globalRoles: ["STUDENT", "CLUB_MEMBER", "CLUB_ADMIN"],
  clubMemberships: []
};

const student: Principal = {
  userId: "student-id",
  email: "student.dev@agu.edu.tr",
  displayName: "Student",
  globalRoles: ["STUDENT"],
  clubMemberships: []
};

const validRequest = {
  clubId: "club-id",
  title: "Draft Event",
  description: "Draft event description",
  startsAt: "2026-08-10T14:00:00+03:00",
  endsAt: "2026-08-10T16:00:00+03:00",
  location: "AGU Buyuk Amfi",
  capacity: 100,
  status: "PUBLISHED",
  createdById: "forged-user-id"
};

function createService({ canCreate = true, clubExists = true } = {}) {
  const createdEvent = {
    id: "event-id",
    clubId: "club-id",
    createdById: "club-admin-id",
    title: "Draft Event",
    slug: "draft-event-12345678",
    description: "Draft event description",
    location: "AGU Buyuk Amfi",
    status: "DRAFT",
    startsAt: new Date("2026-08-10T11:00:00.000Z"),
    endsAt: new Date("2026-08-10T13:00:00.000Z"),
    capacity: 100,
    registrationOpensAt: null,
    registrationClosesAt: null,
    publishedAt: null,
    cancelledAt: null,
    completedAt: null,
    qrTokenHash: null,
    createdAt: new Date("2026-07-23T12:00:00.000Z"),
    updatedAt: new Date("2026-07-23T12:00:00.000Z")
  };

  const prisma = {
    club: {
      findFirst: vi.fn().mockResolvedValue(clubExists ? { id: "club-id" } : null)
    },
    event: {
      create: vi.fn().mockResolvedValue(createdEvent)
    }
  };
  const authorization = {
    canCreateEventForClub: vi.fn().mockResolvedValue(canCreate)
  };

  return {
    service: new EventsService(prisma as never, authorization as never),
    prisma,
    authorization
  };
}

describe("EventsService", () => {
  it("creates a draft event for an authorized club admin", async () => {
    const { service, prisma } = createService();

    const event = await service.createDraftEvent(clubAdmin, validRequest);

    expect(event.status).toBe("DRAFT");
    expect(prisma.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clubId: "club-id",
        createdById: "club-admin-id",
        title: "Draft Event",
        description: "Draft event description",
        location: "AGU Buyuk Amfi",
        status: "DRAFT",
        capacity: 100
      })
    });
  });

  it("does not allow an unauthorized student or club member", async () => {
    const { service } = createService({ canCreate: false });

    await expect(service.createDraftEvent(student, validRequest)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("rejects a start date after the end date", async () => {
    const { service } = createService();

    await expect(
      service.createDraftEvent(clubAdmin, {
        ...validRequest,
        startsAt: "2026-08-10T17:00:00+03:00"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("always creates events as DRAFT", async () => {
    const { service, prisma } = createService();

    await service.createDraftEvent(clubAdmin, {
      ...validRequest,
      status: "PUBLISHED"
    });

    expect(prisma.event.create.mock.calls[0]?.[0].data.status).toBe("DRAFT");
  });

  it("ignores forged createdById and status from the client", async () => {
    const { service, prisma } = createService();

    await service.createDraftEvent(clubAdmin, validRequest);

    expect(prisma.event.create.mock.calls[0]?.[0].data).toEqual(
      expect.objectContaining({
        createdById: "club-admin-id",
        status: "DRAFT"
      })
    );
    expect(prisma.event.create.mock.calls[0]?.[0].data.createdById).not.toBe("forged-user-id");
  });

  it("returns not found when the club does not exist", async () => {
    const { service } = createService({ clubExists: false });

    await expect(service.createDraftEvent(clubAdmin, validRequest)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

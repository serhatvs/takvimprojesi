import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { Principal } from "../auth/principal";
import { toPublicEventListItem, type PublicEventRecord } from "./event-response";
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

const clubMember: Principal = {
  userId: "club-member-id",
  email: "club.member.dev@agu.edu.tr",
  displayName: "Club Member",
  globalRoles: ["STUDENT", "CLUB_MEMBER"],
  clubMemberships: []
};

const pressEditor: Principal = {
  userId: "press-editor-id",
  email: "press.dev@agu.edu.tr",
  displayName: "Press Editor",
  globalRoles: ["PRESS_EDITOR"],
  clubMemberships: []
};

const systemAdmin: Principal = {
  userId: "system-admin-id",
  email: "admin.dev@agu.edu.tr",
  displayName: "System Admin",
  globalRoles: ["SYSTEM_ADMIN"],
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

type CreateServiceOptions = {
  canCreate?: boolean;
  canSubmit?: boolean;
  canReview?: boolean;
  canPublish?: boolean;
  clubExists?: boolean;
  existingStatus?: string;
  updateCount?: number;
  updatedStatus?: string;
  auditFails?: boolean;
  reviewFails?: boolean;
  publicItems?: PublicEventRecord[];
  publicDetail?: PublicEventRecord | null;
  publicCount?: number;
  registrationEvent?: {
    startsAt?: Date;
    capacity?: number | null;
  } | null;
  existingRegistration?: boolean;
  registrationCount?: number;
  registrationCounts?: number[];
  registrationCreateFailsUnique?: boolean;
  registrationStatusEvent?: boolean;
  registrationStatusRegistration?: boolean;
};

function createService({
  canCreate = true,
  canSubmit = true,
  canReview = true,
  canPublish = true,
  clubExists = true,
  existingStatus = "DRAFT",
  updateCount = 1,
  updatedStatus = "SUBMITTED",
  auditFails = false,
  reviewFails = false,
  publicItems = [],
  publicDetail = null,
  publicCount = publicItems.length,
  registrationEvent = {
    startsAt: new Date("2026-08-10T11:00:00.000Z"),
    capacity: 100
  },
  existingRegistration = false,
  registrationCount = 0,
  registrationCounts,
  registrationCreateFailsUnique = false,
  registrationStatusEvent = true,
  registrationStatusRegistration = false
}: CreateServiceOptions = {}) {
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
  const registrationCountMock = vi.fn();
  if (registrationCounts) {
    for (const count of registrationCounts) {
      registrationCountMock.mockResolvedValueOnce(count);
    }
    registrationCountMock.mockResolvedValue(registrationCount);
  } else {
    registrationCountMock.mockResolvedValue(registrationCount);
  }

  const prisma = {
    club: {
      findFirst: vi.fn().mockResolvedValue(clubExists ? { id: "club-id" } : null)
    },
    event: {
      findUnique: vi.fn().mockResolvedValue({
        id: "event-id",
        clubId: "club-id",
        status: existingStatus,
        createdById: "club-admin-id"
      }),
      findFirst: vi.fn().mockImplementation((args) => {
        if (args?.select?.club) {
          return Promise.resolve(publicDetail);
        }

        return Promise.resolve(registrationStatusEvent ? { id: "event-id" } : null);
      }),
      findMany: vi.fn().mockResolvedValue(publicItems),
      count: vi.fn().mockResolvedValue(publicCount),
      create: vi.fn().mockResolvedValue(createdEvent)
    },
    eventRegistration: {
      findUnique: vi.fn().mockResolvedValue(
        registrationStatusRegistration
          ? {
              id: "registration-id",
              eventId: "11111111-1111-4111-8111-111111111111",
              userId: "student-id",
              registeredAt: new Date("2026-07-23T12:00:00.000Z")
            }
          : null
      )
    },
    $transaction: vi.fn(async (callback) => {
      const transaction = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "event-id" }]),
        event: {
          updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
          findFirst: vi.fn().mockResolvedValue(
            registrationEvent
              ? {
                  id: "event-id",
                  startsAt: registrationEvent.startsAt ?? new Date("2026-08-10T11:00:00.000Z"),
                  capacity:
                    registrationEvent.capacity === undefined ? 100 : registrationEvent.capacity
                }
              : null
          ),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            ...createdEvent,
            status: updatedStatus
          })
        },
        eventRegistration: {
          findUnique: vi.fn().mockResolvedValue(
            existingRegistration ? { id: "registration-id" } : null
          ),
          count: registrationCountMock,
          create: registrationCreateFailsUnique
            ? vi.fn().mockRejectedValue({ code: "P2002" })
            : vi.fn().mockImplementation(({ data }) => ({
                id: "registration-id",
                eventId: data.eventId,
                userId: data.userId,
                registeredAt: new Date("2026-07-23T12:00:00.000Z")
              }))
        },
        eventReview: {
          create: reviewFails
            ? vi.fn().mockRejectedValue(new Error("review failed"))
            : vi.fn().mockResolvedValue({ id: "review-id" })
        },
        auditLog: {
          create: auditFails
            ? vi.fn().mockRejectedValue(new Error("audit failed"))
            : vi.fn().mockResolvedValue({ id: "audit-id" })
        }
      };

      return callback(transaction);
    })
  };
  const authorization = {
    canCreateEventForClub: vi.fn().mockResolvedValue(canCreate),
    canSubmitEventForClub: vi.fn().mockResolvedValue(canSubmit),
    canReviewEvents: vi.fn().mockReturnValue(canReview),
    canPublishEvents: vi.fn().mockReturnValue(canPublish)
  };
  const lifecycle = {
    assertTransitionAllowed: vi.fn((from: string, to: string) => {
      if (from === "DRAFT" && to === "SUBMITTED") {
        return;
      }
      if (
        from === "SUBMITTED" &&
        ["CHANGES_REQUESTED", "REJECTED", "APPROVED"].includes(to)
      ) {
        return;
      }
      if (from === "APPROVED" && to === "PUBLISHED") {
        return;
      }

      throw new Error("invalid transition");
    })
  };

  return {
    service: new EventsService(prisma as never, authorization as never, lifecycle as never),
    prisma,
    authorization,
    lifecycle
  };
}

describe("EventsService", () => {
  const futurePublicEvent: PublicEventRecord & {
    createdById: string;
    qrTokenHash: string;
  } = {
    id: "public-event-id",
    title: "Published Event",
    description: "Published description",
    startsAt: new Date("2026-08-10T11:00:00.000Z"),
    endsAt: new Date("2026-08-10T13:00:00.000Z"),
    location: "AGU Buyuk Amfi",
    capacity: 100,
    status: "PUBLISHED",
    publishedAt: new Date("2026-07-23T12:00:00.000Z"),
    club: {
      id: "club-id",
      name: "AGU Yazilim Kulubu",
      slug: "agu-yazilim-kulubu"
    },
    createdById: "internal-user-id",
    qrTokenHash: "internal-token-hash"
  };

  it("lists only published events", async () => {
    const { service, prisma } = createService({ publicItems: [futurePublicEvent] });

    const result = await service.listPublicEvents({});

    expect(result.items).toHaveLength(1);
    expect(prisma.event.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: "PUBLISHED" })
    });
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PUBLISHED" })
      })
    );
  });

  it("excludes draft, submitted, approved, and rejected events through the public status filter", async () => {
    const { service, prisma } = createService();

    await service.listPublicEvents({});

    expect(prisma.event.findMany.mock.calls[0]?.[0].where.status).toBe("PUBLISHED");
  });

  it("excludes past events by default", async () => {
    const { service, prisma } = createService();

    await service.listPublicEvents({});

    expect(prisma.event.findMany.mock.calls[0]?.[0].where.startsAt.gte).toBeInstanceOf(Date);
  });

  it("applies from and to filters inclusively", async () => {
    const { service, prisma } = createService();

    await service.listPublicEvents({
      from: "2026-08-10T00:00:00Z",
      to: "2026-08-10T23:59:59Z"
    });

    expect(prisma.event.findMany.mock.calls[0]?.[0].where.startsAt).toEqual({
      gte: new Date("2026-08-10T00:00:00Z"),
      lte: new Date("2026-08-10T23:59:59Z")
    });
  });

  it("rejects invalid date ranges", async () => {
    const { service } = createService();

    await expect(
      service.listPublicEvents({
        from: "2026-08-11T00:00:00Z",
        to: "2026-08-10T00:00:00Z"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("applies club filtering", async () => {
    const { service, prisma } = createService();

    await service.listPublicEvents({ clubId: "club-id" });

    expect(prisma.event.findMany.mock.calls[0]?.[0].where.clubId).toBe("club-id");
  });

  it("searches title case-insensitively", async () => {
    const { service, prisma } = createService();

    await service.listPublicEvents({ q: "  yazilim  " });

    expect(prisma.event.findMany.mock.calls[0]?.[0].where.OR).toContainEqual({
      title: { contains: "yazilim", mode: "insensitive" }
    });
  });

  it("searches description case-insensitively", async () => {
    const { service, prisma } = createService();

    await service.listPublicEvents({ q: "kampus" });

    expect(prisma.event.findMany.mock.calls[0]?.[0].where.OR).toContainEqual({
      description: { contains: "kampus", mode: "insensitive" }
    });
  });

  it("applies pagination values", async () => {
    const { service, prisma } = createService({ publicCount: 45 });

    const result = await service.listPublicEvents({ page: "2", pageSize: "10" });

    expect(prisma.event.findMany.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ skip: 10, take: 10 })
    );
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 45,
      totalPages: 5
    });
  });

  it("rejects pageSize greater than 100", async () => {
    const { service } = createService();

    await expect(service.listPublicEvents({ pageSize: "101" })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("orders results by startsAt and then id ascending", async () => {
    const { service, prisma } = createService();

    await service.listPublicEvents({});

    expect(prisma.event.findMany.mock.calls[0]?.[0].orderBy).toEqual([
      { startsAt: "asc" },
      { id: "asc" }
    ]);
  });

  it("public mapper omits internal fields", () => {
    const response = toPublicEventListItem(futurePublicEvent);

    expect(response).not.toHaveProperty("createdById");
    expect(response).not.toHaveProperty("qrTokenHash");
    expect(response).not.toHaveProperty("reviews");
    expect(response).not.toHaveProperty("auditLogs");
  });

  it("returns public detail for published events only", async () => {
    const { service, prisma } = createService({ publicDetail: futurePublicEvent });

    const event = await service.getPublicEvent("11111111-1111-4111-8111-111111111111");

    expect(event.id).toBe("public-event-id");
    expect(prisma.event.findFirst).toHaveBeenCalledWith({
      where: {
        id: "11111111-1111-4111-8111-111111111111",
        status: "PUBLISHED"
      },
      select: expect.any(Object)
    });
  });

  it("returns not found for non-public event detail", async () => {
    const { service } = createService({ publicDetail: null });

    await expect(
      service.getPublicEvent("11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns not found for an unknown public detail", async () => {
    const { service } = createService({ publicDetail: null });

    await expect(
      service.getPublicEvent("00000000-0000-4000-8000-000000000000")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("registers a student for a future published event", async () => {
    const { service, prisma } = createService();

    const registration = await service.registerForEvent(
      student,
      "11111111-1111-4111-8111-111111111111"
    );

    expect(registration.eventId).toBe("11111111-1111-4111-8111-111111111111");
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("rejects event registration for users without the student role", async () => {
    const { service } = createService();

    await expect(
      service.registerForEvent(pressEditor, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns not found when registering for a non-public event", async () => {
    const { service } = createService({ registrationEvent: null });

    await expect(
      service.registerForEvent(student, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects registration for an already started event", async () => {
    const { service } = createService({
      registrationEvent: {
        startsAt: new Date("2026-07-01T11:00:00.000Z"),
        capacity: 100
      }
    });

    await expect(
      service.registerForEvent(student, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects duplicate registration", async () => {
    const { service } = createService({ existingRegistration: true });

    await expect(
      service.registerForEvent(student, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps unique constraint failures to duplicate registration conflict", async () => {
    const { service } = createService({ registrationCreateFailsUnique: true });

    await expect(
      service.registerForEvent(student, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects registration when event capacity is full", async () => {
    const { service } = createService({
      registrationEvent: {
        startsAt: new Date("2026-08-10T11:00:00.000Z"),
        capacity: 1
      },
      registrationCount: 1
    });

    await expect(
      service.registerForEvent(student, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("allows unlimited registration when capacity is null", async () => {
    const { service } = createService({
      registrationEvent: {
        startsAt: new Date("2026-08-10T11:00:00.000Z"),
        capacity: null
      }
    });

    await expect(
      service.registerForEvent(student, "11111111-1111-4111-8111-111111111111")
    ).resolves.toMatchObject({
      eventId: "11111111-1111-4111-8111-111111111111",
      userId: student.userId
    });
  });

  it("uses the authenticated principal user id for registration", async () => {
    const { service } = createService();

    const registration = await service.registerForEvent(
      student,
      "11111111-1111-4111-8111-111111111111"
    );

    expect(registration.userId).toBe(student.userId);
  });

  it("lets only one racing final-capacity registration succeed", async () => {
    const { service } = createService({
      registrationEvent: {
        startsAt: new Date("2026-08-10T11:00:00.000Z"),
        capacity: 1
      },
      registrationCounts: [0, 1]
    });

    const results = await Promise.allSettled([
      service.registerForEvent(student, "11111111-1111-4111-8111-111111111111"),
      service.registerForEvent(clubMember, "11111111-1111-4111-8111-111111111111")
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("returns only the authenticated student's registration status", async () => {
    const { service, prisma } = createService({ registrationStatusRegistration: true });

    const registration = await service.getEventRegistrationStatus(
      student,
      "11111111-1111-4111-8111-111111111111"
    );

    expect(registration).toMatchObject({
      eventId: "11111111-1111-4111-8111-111111111111",
      userId: student.userId
    });
    expect(prisma.eventRegistration.findUnique).toHaveBeenCalledWith({
      where: {
        eventId_userId: {
          eventId: "11111111-1111-4111-8111-111111111111",
          userId: student.userId
        }
      }
    });
  });

  it("returns null when the authenticated student has no registration", async () => {
    const { service } = createService({ registrationStatusRegistration: false });

    await expect(
      service.getEventRegistrationStatus(student, "11111111-1111-4111-8111-111111111111")
    ).resolves.toBeNull();
  });

  it("rejects registration status for users without the student role", async () => {
    const { service } = createService();

    await expect(
      service.getEventRegistrationStatus(pressEditor, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns not found for non-public registration status events", async () => {
    const { service } = createService({ registrationStatusEvent: false });

    await expect(
      service.getEventRegistrationStatus(student, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

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

  it("allows an authorized club admin to submit their club draft event", async () => {
    const { service, prisma, lifecycle } = createService();

    const event = await service.submitDraftEvent(clubAdmin, "11111111-1111-4111-8111-111111111111");

    expect(event.status).toBe("SUBMITTED");
    expect(lifecycle.assertTransitionAllowed).toHaveBeenCalledWith("DRAFT", "SUBMITTED", [
      "CLUB_ADMIN"
    ]);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("does not allow a normal club member to submit", async () => {
    const { service } = createService({ canSubmit: false });

    await expect(
      service.submitDraftEvent(clubMember, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not allow another club admin to submit", async () => {
    const { service } = createService({ canSubmit: false });

    await expect(
      service.submitDraftEvent(clubAdmin, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not allow a press editor only by global role", async () => {
    const { service } = createService({ canSubmit: false });

    await expect(
      service.submitDraftEvent(pressEditor, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows system admin through explicit bypass", async () => {
    const { service, lifecycle } = createService();

    const event = await service.submitDraftEvent(systemAdmin, "11111111-1111-4111-8111-111111111111");

    expect(event.status).toBe("SUBMITTED");
    expect(lifecycle.assertTransitionAllowed).toHaveBeenCalledWith("DRAFT", "SUBMITTED", [
      "SYSTEM_ADMIN"
    ]);
  });

  it("does not submit an already submitted event", async () => {
    const { service } = createService({ existingStatus: "SUBMITTED" });

    await expect(
      service.submitDraftEvent(clubAdmin, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each(["PUBLISHED", "REJECTED", "CANCELLED", "COMPLETED"])(
    "does not submit an event in %s status",
    async (existingStatus) => {
      const { service } = createService({ existingStatus });

      await expect(
        service.submitDraftEvent(clubAdmin, "11111111-1111-4111-8111-111111111111")
      ).rejects.toBeInstanceOf(ConflictException);
    }
  );

  it("creates the event update and audit record inside one transaction", async () => {
    const calls: string[] = [];
    const transactionClient = {
      event: {
        updateMany: vi.fn(async () => {
          calls.push("update");
          return { count: 1 };
        }),
        findUniqueOrThrow: vi.fn(async () => {
          calls.push("read");
          return { status: "SUBMITTED" };
        })
      },
      auditLog: {
        create: vi.fn(async () => {
          calls.push("audit");
          return { id: "audit-id" };
        })
      }
    };
    const { service, prisma } = createService();
    prisma.$transaction.mockImplementationOnce(async (callback) => callback(transactionClient));

    await service.submitDraftEvent(clubAdmin, "11111111-1111-4111-8111-111111111111");

    expect(calls).toEqual(["update", "audit", "read"]);
    expect(transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "club-admin-id",
        entityType: "Event",
        entityId: "11111111-1111-4111-8111-111111111111",
        action: "EVENT_SUBMITTED",
        before: { status: "DRAFT" },
        after: { status: "SUBMITTED" }
      })
    });
  });

  it("does not create audit when conditional event update fails", async () => {
    const transactionClient = {
      event: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn()
      },
      auditLog: {
        create: vi.fn()
      }
    };
    const { service, prisma } = createService();
    prisma.$transaction.mockImplementationOnce(async (callback) => callback(transactionClient));

    await expect(
      service.submitDraftEvent(clubAdmin, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transactionClient.auditLog.create).not.toHaveBeenCalled();
  });

  it("bubbles audit failure so the transaction can roll back the status update", async () => {
    const { service } = createService({ auditFails: true });

    await expect(
      service.submitDraftEvent(clubAdmin, "11111111-1111-4111-8111-111111111111")
    ).rejects.toThrow("audit failed");
  });

  it("returns conflict for a repeated or concurrent second submit", async () => {
    const { service } = createService({ updateCount: 0 });

    await expect(
      service.submitDraftEvent(clubAdmin, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("allows a press editor to request changes", async () => {
    const { service, lifecycle } = createService({
      existingStatus: "SUBMITTED",
      updatedStatus: "CHANGES_REQUESTED"
    });

    const event = await service.reviewEvent(
      pressEditor,
      "11111111-1111-4111-8111-111111111111",
      "CHANGES_REQUESTED",
      " Please update the venue. "
    );

    expect(event.status).toBe("CHANGES_REQUESTED");
    expect(lifecycle.assertTransitionAllowed).toHaveBeenCalledWith(
      "SUBMITTED",
      "CHANGES_REQUESTED",
      ["PRESS_EDITOR"]
    );
  });

  it("allows a press editor to reject", async () => {
    const { service } = createService({
      existingStatus: "SUBMITTED",
      updatedStatus: "REJECTED"
    });

    const event = await service.reviewEvent(
      pressEditor,
      "11111111-1111-4111-8111-111111111111",
      "REJECTED",
      "Policy mismatch."
    );

    expect(event.status).toBe("REJECTED");
  });

  it("allows a press editor to approve", async () => {
    const { service } = createService({
      existingStatus: "SUBMITTED",
      updatedStatus: "APPROVED"
    });

    const event = await service.reviewEvent(
      pressEditor,
      "11111111-1111-4111-8111-111111111111",
      "APPROVED"
    );

    expect(event.status).toBe("APPROVED");
  });

  it("allows system admin to review through explicit bypass", async () => {
    const { service, lifecycle } = createService({
      existingStatus: "SUBMITTED",
      updatedStatus: "APPROVED"
    });

    const event = await service.reviewEvent(
      systemAdmin,
      "11111111-1111-4111-8111-111111111111",
      "APPROVED"
    );

    expect(event.status).toBe("APPROVED");
    expect(lifecycle.assertTransitionAllowed).toHaveBeenCalledWith("SUBMITTED", "APPROVED", [
      "SYSTEM_ADMIN"
    ]);
  });

  it("does not allow a club admin to review", async () => {
    const { service } = createService({ canReview: false, existingStatus: "SUBMITTED" });

    await expect(
      service.reviewEvent(
        clubAdmin,
        "11111111-1111-4111-8111-111111111111",
        "APPROVED"
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("only reviews submitted events", async () => {
    const { service } = createService({ existingStatus: "DRAFT" });

    await expect(
      service.reviewEvent(
        pressEditor,
        "11111111-1111-4111-8111-111111111111",
        "APPROVED"
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects blank request-changes and reject comments", async () => {
    const { service } = createService({ existingStatus: "SUBMITTED" });

    await expect(
      service.reviewEvent(
        pressEditor,
        "11111111-1111-4111-8111-111111111111",
        "CHANGES_REQUESTED",
        " "
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.reviewEvent(
        pressEditor,
        "11111111-1111-4111-8111-111111111111",
        "REJECTED",
        ""
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates EventReview and AuditLog inside one review transaction", async () => {
    const calls: string[] = [];
    const transactionClient = {
      event: {
        updateMany: vi.fn(async () => {
          calls.push("update");
          return { count: 1 };
        }),
        findUniqueOrThrow: vi.fn(async () => {
          calls.push("read");
          return { status: "APPROVED" };
        })
      },
      eventReview: {
        create: vi.fn(async () => {
          calls.push("review");
          return { id: "review-id" };
        })
      },
      auditLog: {
        create: vi.fn(async () => {
          calls.push("audit");
          return { id: "audit-id" };
        })
      }
    };
    const { service, prisma } = createService({ existingStatus: "SUBMITTED" });
    prisma.$transaction.mockImplementationOnce(async (callback) => callback(transactionClient));

    await service.reviewEvent(
      pressEditor,
      "11111111-1111-4111-8111-111111111111",
      "APPROVED",
      "Ready."
    );

    expect(calls).toEqual(["update", "review", "audit", "read"]);
    expect(transactionClient.eventReview.create).toHaveBeenCalledWith({
      data: {
        eventId: "11111111-1111-4111-8111-111111111111",
        reviewerId: "press-editor-id",
        decision: "APPROVED",
        comment: "Ready."
      }
    });
    expect(transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "press-editor-id",
        entityType: "Event",
        entityId: "11111111-1111-4111-8111-111111111111",
        action: "EVENT_APPROVED",
        before: { status: "SUBMITTED" },
        after: { status: "APPROVED" }
      })
    });
  });

  it("does not create review or audit when conditional review update fails", async () => {
    const transactionClient = {
      event: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn()
      },
      eventReview: {
        create: vi.fn()
      },
      auditLog: {
        create: vi.fn()
      }
    };
    const { service, prisma } = createService({ existingStatus: "SUBMITTED" });
    prisma.$transaction.mockImplementationOnce(async (callback) => callback(transactionClient));

    await expect(
      service.reviewEvent(
        pressEditor,
        "11111111-1111-4111-8111-111111111111",
        "APPROVED"
      )
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transactionClient.eventReview.create).not.toHaveBeenCalled();
    expect(transactionClient.auditLog.create).not.toHaveBeenCalled();
  });

  it("bubbles review transaction failure so partial review state can roll back", async () => {
    const { service } = createService({ existingStatus: "SUBMITTED", reviewFails: true });

    await expect(
      service.reviewEvent(
        pressEditor,
        "11111111-1111-4111-8111-111111111111",
        "APPROVED"
      )
    ).rejects.toThrow("review failed");
  });

  it("bubbles review audit failure so the transaction can roll back", async () => {
    const { service } = createService({ existingStatus: "SUBMITTED", auditFails: true });

    await expect(
      service.reviewEvent(
        pressEditor,
        "11111111-1111-4111-8111-111111111111",
        "APPROVED"
      )
    ).rejects.toThrow("audit failed");
  });

  it("returns conflict for a concurrent second review decision", async () => {
    const { service } = createService({ existingStatus: "SUBMITTED", updateCount: 0 });

    await expect(
      service.reviewEvent(
        pressEditor,
        "11111111-1111-4111-8111-111111111111",
        "APPROVED"
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("allows a press editor to publish an approved event", async () => {
    const { service, lifecycle } = createService({
      existingStatus: "APPROVED",
      updatedStatus: "PUBLISHED"
    });

    const event = await service.publishEvent(
      pressEditor,
      "11111111-1111-4111-8111-111111111111"
    );

    expect(event.status).toBe("PUBLISHED");
    expect(lifecycle.assertTransitionAllowed).toHaveBeenCalledWith(
      "APPROVED",
      "PUBLISHED",
      ["PRESS_EDITOR"]
    );
  });

  it("allows a system admin to publish an approved event", async () => {
    const { service, lifecycle } = createService({
      existingStatus: "APPROVED",
      updatedStatus: "PUBLISHED"
    });

    const event = await service.publishEvent(
      systemAdmin,
      "11111111-1111-4111-8111-111111111111"
    );

    expect(event.status).toBe("PUBLISHED");
    expect(lifecycle.assertTransitionAllowed).toHaveBeenCalledWith(
      "APPROVED",
      "PUBLISHED",
      ["SYSTEM_ADMIN"]
    );
  });

  it("does not allow a club admin to publish", async () => {
    const { service } = createService({ canPublish: false, existingStatus: "APPROVED" });

    await expect(
      service.publishEvent(clubAdmin, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(["SUBMITTED", "DRAFT", "REJECTED", "CHANGES_REQUESTED", "PUBLISHED", "CANCELLED"])(
    "does not publish an event in %s status",
    async (existingStatus) => {
      const { service } = createService({ existingStatus });

      await expect(
        service.publishEvent(pressEditor, "11111111-1111-4111-8111-111111111111")
      ).rejects.toBeInstanceOf(ConflictException);
    }
  );

  it("creates publish event update and audit inside one transaction", async () => {
    const calls: string[] = [];
    const transactionClient = {
      event: {
        updateMany: vi.fn(async () => {
          calls.push("update");
          return { count: 1 };
        }),
        findUniqueOrThrow: vi.fn(async () => {
          calls.push("read");
          return { status: "PUBLISHED" };
        })
      },
      auditLog: {
        create: vi.fn(async () => {
          calls.push("audit");
          return { id: "audit-id" };
        })
      }
    };
    const { service, prisma } = createService({ existingStatus: "APPROVED" });
    prisma.$transaction.mockImplementationOnce(async (callback) => callback(transactionClient));

    await service.publishEvent(pressEditor, "11111111-1111-4111-8111-111111111111");

    expect(calls).toEqual(["update", "audit", "read"]);
    expect(transactionClient.event.updateMany).toHaveBeenCalledWith({
      where: {
        id: "11111111-1111-4111-8111-111111111111",
        status: "APPROVED"
      },
      data: {
        status: "PUBLISHED",
        publishedAt: expect.any(Date)
      }
    });
    expect(transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "press-editor-id",
        entityType: "Event",
        entityId: "11111111-1111-4111-8111-111111111111",
        action: "EVENT_PUBLISHED",
        before: { status: "APPROVED" },
        after: { status: "PUBLISHED" }
      })
    });
  });

  it("bubbles publish audit failure so the transaction can roll back", async () => {
    const { service } = createService({ existingStatus: "APPROVED", auditFails: true });

    await expect(
      service.publishEvent(pressEditor, "11111111-1111-4111-8111-111111111111")
    ).rejects.toThrow("audit failed");
  });

  it("does not create publish audit when conditional update fails", async () => {
    const transactionClient = {
      event: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn()
      },
      auditLog: {
        create: vi.fn()
      }
    };
    const { service, prisma } = createService({ existingStatus: "APPROVED" });
    prisma.$transaction.mockImplementationOnce(async (callback) => callback(transactionClient));

    await expect(
      service.publishEvent(pressEditor, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transactionClient.auditLog.create).not.toHaveBeenCalled();
  });

  it("returns conflict for a repeated or concurrent second publish", async () => {
    const { service } = createService({ existingStatus: "APPROVED", updateCount: 0 });

    await expect(
      service.publishEvent(pressEditor, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
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

function createService({
  canCreate = true,
  canSubmit = true,
  clubExists = true,
  existingStatus = "DRAFT",
  updateCount = 1,
  auditFails = false
} = {}) {
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
      findUnique: vi.fn().mockResolvedValue({
        id: "event-id",
        clubId: "club-id",
        status: existingStatus,
        createdById: "club-admin-id"
      }),
      create: vi.fn().mockResolvedValue(createdEvent)
    },
    $transaction: vi.fn(async (callback) =>
      callback({
        event: {
          updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            ...createdEvent,
            status: "SUBMITTED"
          })
        },
        auditLog: {
          create: auditFails
            ? vi.fn().mockRejectedValue(new Error("audit failed"))
            : vi.fn().mockResolvedValue({ id: "audit-id" })
        }
      })
    )
  };
  const authorization = {
    canCreateEventForClub: vi.fn().mockResolvedValue(canCreate),
    canSubmitEventForClub: vi.fn().mockResolvedValue(canSubmit)
  };
  const lifecycle = {
    assertTransitionAllowed: vi.fn((from: string, to: string) => {
      if (from !== "DRAFT" || to !== "SUBMITTED") {
        throw new Error("invalid transition");
      }
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
});

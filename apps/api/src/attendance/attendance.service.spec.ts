import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { Principal } from "../auth/principal";
import { AttendanceTokenService } from "./attendance-token.service";
import { AttendanceService } from "./attendance.service";

const clubAdmin: Principal = {
  userId: "club-admin-id",
  email: "club.admin@agu.edu.tr",
  displayName: "Club Admin",
  globalRoles: ["CLUB_ADMIN"],
  clubMemberships: [{ clubId: "club-id", role: "ADMIN", clubSlug: "club-slug", clubName: "Club Name" }]
};

const otherClubAdmin: Principal = {
  userId: "other-club-admin-id",
  email: "other.admin@agu.edu.tr",
  displayName: "Other Admin",
  globalRoles: ["CLUB_ADMIN"],
  clubMemberships: [{ clubId: "other-club-id", role: "ADMIN", clubSlug: "other-club-slug", clubName: "Other Club Name" }]
};

const systemAdmin: Principal = {
  userId: "system-admin-id",
  email: "sysadmin@agu.edu.tr",
  displayName: "System Admin",
  globalRoles: ["SYSTEM_ADMIN"],
  clubMemberships: []
};

const student: Principal = {
  userId: "student-id",
  email: "student@agu.edu.tr",
  displayName: "Student User",
  globalRoles: ["STUDENT"],
  clubMemberships: []
};

const pressEditor: Principal = {
  userId: "press-editor-id",
  email: "press@agu.edu.tr",
  displayName: "Press Editor",
  globalRoles: ["PRESS_EDITOR"],
  clubMemberships: []
};

const validEventId = "11111111-1111-4111-8111-111111111111";

type CreateServiceOptions = {
  eventExists?: boolean;
  eventStatus?: string;
  startsAt?: Date;
  endsAt?: Date;
  canIssue?: boolean;
  isRegistered?: boolean;
  hasCheckedIn?: boolean;
};

function createService({
  eventExists = true,
  eventStatus = "PUBLISHED",
  startsAt = new Date(Date.now() - 10 * 60 * 1000), // Started 10m ago
  endsAt = new Date(Date.now() + 50 * 60 * 1000),   // Ends in 50m
  canIssue = true,
  isRegistered = true,
  hasCheckedIn = false
}: CreateServiceOptions = {}) {
  const tokenService = new AttendanceTokenService();

  const prisma = {
    event: {
      findUnique: vi.fn().mockImplementation((args) => {
        if (!eventExists) return Promise.resolve(null);
        return Promise.resolve({
          id: args.where.id,
          clubId: "club-id",
          status: eventStatus,
          startsAt,
          endsAt
        });
      }),
      findFirst: vi.fn().mockImplementation((args) => {
        if (!eventExists || eventStatus !== "PUBLISHED") return Promise.resolve(null);
        return Promise.resolve({
          id: args.where.id,
          startsAt,
          endsAt
        });
      })
    },
    eventRegistration: {
      findUnique: vi.fn().mockImplementation(() => {
        if (!isRegistered) return Promise.resolve(null);
        return Promise.resolve({
          id: "registration-id",
          cancelledAt: null
        });
      })
    },
    attendance: {
      create: hasCheckedIn
        ? vi.fn().mockRejectedValue({ code: "P2002" })
        : vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({
              id: "attendance-id",
              eventId: data.eventId,
              userId: data.userId,
              source: data.source,
              checkedInAt: new Date()
            })
          )
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-id" })
    },
    $transaction: vi.fn(async (cb) => cb(prisma))
  };

  const authorizationService = {
    canIssueAttendanceTokenForClub: vi.fn().mockResolvedValue(canIssue)
  };

  const service = new AttendanceService(
    prisma as never,
    authorizationService as never,
    tokenService
  );

  return { service, tokenService, prisma, authorizationService };
}

describe("AttendanceService", () => {
  describe("issueAttendanceToken", () => {
    it("allows authorized club admin to issue token for event", async () => {
      const { service, tokenService } = createService({ canIssue: true });

      const result = await service.issueAttendanceToken(clubAdmin, validEventId);

      expect(result.eventId).toBe(validEventId);
      expect(typeof result.token).toBe("string");
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const verified = tokenService.verifyAttendanceToken(result.token);
      expect(verified.eventId).toBe(validEventId);
      expect(verified.purpose).toBe("attendance-check-in");
    });

    it("allows SYSTEM_ADMIN to issue token for event", async () => {
      const { service } = createService({ canIssue: true });

      const result = await service.issueAttendanceToken(systemAdmin, validEventId);
      expect(result.eventId).toBe(validEventId);
    });

    it("rejects unauthorized club admin (other club) with 403 Forbidden", async () => {
      const { service } = createService({ canIssue: false });

      await expect(
        service.issueAttendanceToken(otherClubAdmin, validEventId)
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects STUDENT with 403 Forbidden", async () => {
      const { service } = createService({ canIssue: false });

      await expect(
        service.issueAttendanceToken(student, validEventId)
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects PRESS_EDITOR only with 403 Forbidden", async () => {
      const { service } = createService({ canIssue: false });

      await expect(
        service.issueAttendanceToken(pressEditor, validEventId)
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws 404 NotFoundException for missing event", async () => {
      const { service } = createService({ eventExists: false });

      await expect(
        service.issueAttendanceToken(clubAdmin, validEventId)
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws 400 BadRequestException for invalid event UUID format", async () => {
      const { service } = createService();

      await expect(
        service.issueAttendanceToken(clubAdmin, "invalid-uuid")
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each(["DRAFT", "SUBMITTED", "CHANGES_REQUESTED", "REJECTED", "APPROVED", "CANCELLED", "COMPLETED"])(
      "rejects token issuing for non-PUBLISHED status %s with 409 Conflict",
      async (status) => {
        const { service } = createService({ eventStatus: status });

        await expect(
          service.issueAttendanceToken(clubAdmin, validEventId)
        ).rejects.toBeInstanceOf(ConflictException);
      }
    );

    it("rejects token issuing when outside attendance window (too early)", async () => {
      const startsAt = new Date(Date.now() + 60 * 60 * 1000); // Starts in 60m (opens in 30m)
      const endsAt = new Date(Date.now() + 120 * 60 * 1000);
      const { service } = createService({ startsAt, endsAt });

      await expect(
        service.issueAttendanceToken(clubAdmin, validEventId)
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects token issuing when outside attendance window (too late)", async () => {
      const startsAt = new Date(Date.now() - 120 * 60 * 1000);
      const endsAt = new Date(Date.now() - 40 * 60 * 1000); // Ended 40m ago (closed 10m ago)
      const { service } = createService({ startsAt, endsAt });

      await expect(
        service.issueAttendanceToken(clubAdmin, validEventId)
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("checkIn", () => {
    it("allows STUDENT with valid token and registration to check in", async () => {
      const { service, tokenService, prisma } = createService({ isRegistered: true });
      const { token } = tokenService.generateAttendanceToken(validEventId);

      const attendance = await service.checkIn(student, token);

      expect(attendance.eventId).toBe(validEventId);
      expect(attendance.userId).toBe(student.userId);
      expect(attendance.source).toBe("QR");

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: student.userId,
          entityType: "Event",
          entityId: validEventId,
          action: "EVENT_ATTENDANCE_RECORDED"
        })
      });
      const auditCall = (prisma.auditLog.create.mock.calls[0] as [{ data: { metadata?: unknown } }] | undefined)?.[0];
      expect(auditCall).toBeDefined();
      expect(JSON.stringify(auditCall?.data.metadata)).not.toContain(token);
    });

    it("rejects non-STUDENT user with 403 Forbidden", async () => {
      const { service, tokenService } = createService();
      const { token } = tokenService.generateAttendanceToken(validEventId);

      await expect(service.checkIn(clubAdmin, token)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.checkIn(systemAdmin, token)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.checkIn(pressEditor, token)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects unregistered student with 409 Conflict", async () => {
      const { service, tokenService } = createService({ isRegistered: false });
      const { token } = tokenService.generateAttendanceToken(validEventId);

      await expect(service.checkIn(student, token)).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects duplicate check-in with 409 Conflict", async () => {
      const { service, tokenService } = createService({ isRegistered: true, hasCheckedIn: true });
      const { token } = tokenService.generateAttendanceToken(validEventId);

      await expect(service.checkIn(student, token)).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects check-in outside attendance window (too late)", async () => {
      const startsAt = new Date(Date.now() - 120 * 60 * 1000);
      const endsAt = new Date(Date.now() - 45 * 60 * 1000); // Closed 15m ago
      const { service, tokenService } = createService({ startsAt, endsAt });
      const { token } = tokenService.generateAttendanceToken(validEventId);

      await expect(service.checkIn(student, token)).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects invalid, tampered or expired token with BadRequestException (400)", async () => {
      const { service, tokenService } = createService();
      const { token } = tokenService.generateAttendanceToken(validEventId);
      const tampered = token + "bad";

      await expect(service.checkIn(student, tampered)).rejects.toBeInstanceOf(
        BadRequestException
      );

      const expiredToken = tokenService.generateAttendanceToken(validEventId, -10).token;
      await expect(service.checkIn(student, expiredToken)).rejects.toBeInstanceOf(
        BadRequestException
      );
    });

    it("takes userId strictly from principal, ignoring any payload manipulation", async () => {
      const { service, tokenService } = createService({ isRegistered: true });
      const { token } = tokenService.generateAttendanceToken(validEventId);

      const res = await service.checkIn(student, token);
      expect(res.userId).toBe("student-id");
    });
  });
});

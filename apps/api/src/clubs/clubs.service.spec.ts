import {
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { Principal } from "../auth/principal";
import { ClubsService } from "./clubs.service";

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

const systemAdmin: Principal = {
  userId: "system-admin-id",
  email: "admin.dev@agu.edu.tr",
  displayName: "System Admin",
  globalRoles: ["SYSTEM_ADMIN"],
  clubMemberships: []
};

function createService({
  canManage = true,
  clubExists = true,
  manageableClubs = [],
  clubEvents = [],
  clubEventsCount = 0,
  groupedStatuses = []
}: any = {}) {
  const prisma = {
    club: {
      findFirst: vi.fn().mockResolvedValue(clubExists ? { id: "club-id", isActive: true } : null),
      findMany: vi.fn().mockResolvedValue(manageableClubs)
    },
    event: {
      findMany: vi.fn().mockResolvedValue(clubEvents),
      count: vi.fn().mockResolvedValue(clubEventsCount),
      groupBy: vi.fn().mockResolvedValue(groupedStatuses)
    }
  };

  const authorizationService = {
    canManageClub: vi.fn().mockResolvedValue(canManage)
  };

  const service = new ClubsService(prisma as any, authorizationService as any);

  return { service, prisma, authorizationService };
}

describe("ClubsService", () => {
  describe("getManageableClubs", () => {
    it("SYSTEM_ADMIN gets all active clubs", async () => {
      const { service, prisma } = createService({
        manageableClubs: [
          { id: "club-1", name: "Club 1" },
          { id: "club-2", name: "Club 2" }
        ]
      });

      const result = await service.getManageableClubs(systemAdmin);
      
      expect(result).toHaveLength(2);
      expect(prisma.club.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: expect.any(Object),
        orderBy: [{ name: "asc" }, { id: "asc" }]
      });
    });

    it("CLUB_ADMIN gets clubs where they are admin", async () => {
      const { service, prisma } = createService({
        manageableClubs: [{ id: "club-1", name: "Club 1" }]
      });

      const result = await service.getManageableClubs(clubAdmin);

      expect(result).toHaveLength(1);
      expect(prisma.club.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            memberships: {
              some: {
                userId: clubAdmin.userId,
                role: "ADMIN",
                isActive: true
              }
            }
          }
        })
      );
    });

    it("Student gets empty array", async () => {
      const { service } = createService({ manageableClubs: [] });

      const result = await service.getManageableClubs(student);

      expect(result).toHaveLength(0);
    });
  });

  describe("getClubEvents", () => {
    const validClubId = "12345678-1234-1234-8234-1234567890ab";

    it("returns events with pagination for authorized admin", async () => {
      const { service, prisma } = createService({
        canManage: true,
        clubExists: true,
        clubEvents: [{ id: "event-1" }],
        clubEventsCount: 1,
        groupedStatuses: [{ status: "PUBLISHED", _count: { _all: 1 } }]
      });

      const result = await service.getClubEvents(clubAdmin, validClubId, { page: "1", pageSize: "10" });

      expect(result.items).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1
      });
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clubId: validClubId },
          skip: 0,
          take: 10
        })
      );
    });

    it("returns status counts for all events in club", async () => {
      const { service } = createService({
        canManage: true,
        clubExists: true,
        groupedStatuses: [
          { status: "DRAFT", _count: { _all: 5 } },
          { status: "PUBLISHED", _count: { _all: 2 } }
        ]
      });

      const result = await service.getClubEvents(clubAdmin, validClubId, {});

      expect(result.statusCounts).toMatchObject({
        DRAFT: 5,
        PUBLISHED: 2,
        SUBMITTED: 0
      });
    });

    it("returns NotFoundException for non-existent club", async () => {
      const { service } = createService({ clubExists: false });

      await expect(service.getClubEvents(clubAdmin, validClubId, {})).rejects.toThrow(
        NotFoundException
      );
    });

    it("returns ForbiddenException for unauthorized user", async () => {
      const { service } = createService({ canManage: false, clubExists: true });

      await expect(service.getClubEvents(student, validClubId, {})).rejects.toThrow(
        ForbiddenException
      );
    });

    it("search filter works (q parameter)", async () => {
      const { service, prisma } = createService({ canManage: true, clubExists: true });

      await service.getClubEvents(clubAdmin, validClubId, { q: "test query" });

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clubId: validClubId,
            OR: [
              { title: { contains: "test query", mode: "insensitive" } },
              { description: { contains: "test query", mode: "insensitive" } }
            ]
          })
        })
      );
    });

    it("status filter works", async () => {
      const { service, prisma } = createService({ canManage: true, clubExists: true });

      await service.getClubEvents(clubAdmin, validClubId, { status: "PUBLISHED" });

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clubId: validClubId,
            status: "PUBLISHED"
          })
        })
      );
    });

    it("invalid clubId throws BadRequestException", async () => {
      const { service } = createService();

      await expect(service.getClubEvents(clubAdmin, "invalid-uuid", {})).rejects.toThrow(
        BadRequestException
      );
    });
  });
});

import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Principal } from "../auth/principal";
import type { PrismaService } from "../prisma/prisma.service";
import { PressService } from "./press.service";

describe("PressService", () => {
  let service: PressService;
  let prismaMock: {
    event: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const pressPrincipal: Principal = {
    userId: "press-user-id",
    email: "press@agu.edu.tr",
    displayName: "Press Editor",
    globalRoles: ["PRESS_EDITOR"],
    clubMemberships: []
  };

  const adminPrincipal: Principal = {
    userId: "admin-user-id",
    email: "admin@agu.edu.tr",
    displayName: "System Admin",
    globalRoles: ["SYSTEM_ADMIN"],
    clubMemberships: []
  };

  const studentPrincipal: Principal = {
    userId: "student-user-id",
    email: "student@agu.edu.tr",
    displayName: "Student",
    globalRoles: ["STUDENT"],
    clubMemberships: []
  };

  const clubAdminPrincipal: Principal = {
    userId: "club-admin-id",
    email: "clubadmin@agu.edu.tr",
    displayName: "Club Admin",
    globalRoles: ["CLUB_ADMIN"],
    clubMemberships: [{ clubId: "c1", clubSlug: "club-1", clubName: "Club 1", role: "ADMIN" }]
  };

  beforeEach(() => {
    prismaMock = {
      event: {
        count: vi.fn(),
        findMany: vi.fn()
      }
    };

    service = new PressService(prismaMock as unknown as PrismaService);
  });

  describe("listSubmittedEvents authorization", () => {
    it("allows PRESS_EDITOR to list queue", async () => {
      prismaMock.event.count.mockResolvedValue(0);
      prismaMock.event.findMany.mockResolvedValue([]);

      const result = await service.listSubmittedEvents(pressPrincipal, {});
      expect(result.items).toEqual([]);
    });

    it("allows SYSTEM_ADMIN to list queue", async () => {
      prismaMock.event.count.mockResolvedValue(0);
      prismaMock.event.findMany.mockResolvedValue([]);

      const result = await service.listSubmittedEvents(adminPrincipal, {});
      expect(result.items).toEqual([]);
    });

    it("throws 403 for STUDENT", async () => {
      await expect(service.listSubmittedEvents(studentPrincipal, {})).rejects.toThrow(
        ForbiddenException
      );
    });

    it("throws 403 for CLUB_ADMIN-only user", async () => {
      await expect(service.listSubmittedEvents(clubAdminPrincipal, {})).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe("query validation & pagination", () => {
    it("rejects pageSize > 100 with 400", async () => {
      await expect(
        service.listSubmittedEvents(pressPrincipal, { pageSize: "150" })
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects invalid page or pageSize", async () => {
      await expect(
        service.listSubmittedEvents(pressPrincipal, { page: "-1" })
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.listSubmittedEvents(pressPrincipal, { pageSize: "0" })
      ).rejects.toThrow(BadRequestException);
    });

    it("applies status=SUBMITTED and orderBy updatedAt asc, id asc", async () => {
      prismaMock.event.count.mockResolvedValue(1);
      const mockDate = new Date("2026-08-10T12:00:00.000Z");
      prismaMock.event.findMany.mockResolvedValue([
        {
          id: "evt-1",
          title: "Submitted Event",
          description: "Desc",
          status: "SUBMITTED",
          startsAt: mockDate,
          endsAt: mockDate,
          location: "Hall A",
          capacity: 100,
          createdAt: mockDate,
          updatedAt: mockDate,
          club: { id: "club-1", name: "Music Club" }
        }
      ]);

      const result = await service.listSubmittedEvents(pressPrincipal, { q: "Music", page: "1", pageSize: "10" });

      expect(prismaMock.event.findMany).toHaveBeenCalledWith({
        where: {
          status: "SUBMITTED",
          OR: [
            { title: { contains: "Music", mode: "insensitive" } },
            { description: { contains: "Music", mode: "insensitive" } },
            { club: { name: { contains: "Music", mode: "insensitive" } } }
          ]
        },
        select: expect.any(Object),
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        skip: 0,
        take: 10
      });

      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1
      });
      expect(result.items[0]?.title).toBe("Submitted Event");
      expect(result.items[0]?.club.name).toBe("Music Club");
    });
  });
});

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, EventStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthorizationService } from "../auth/authorization.service";
import type { Principal } from "../auth/principal";
import type { ClubEventsQueryDto } from "./dto/club-events-query.dto";
import { EVENT_STATUSES } from "@agu/contracts";

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService
  ) {}

  async getManageableClubs(principal: Principal) {
    if (principal.globalRoles.includes("SYSTEM_ADMIN")) {
      return this.prisma.club.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
        },
        orderBy: [{ name: "asc" }, { id: "asc" }]
      });
    }

    return this.prisma.club.findMany({
      where: {
        isActive: true,
        memberships: {
          some: {
            userId: principal.userId,
            role: "ADMIN",
            isActive: true
          }
        }
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }]
    });
  }

  async getClubEvents(principal: Principal, clubId: string, query: ClubEventsQueryDto) {
    this.assertValidClubId(clubId);

    const club = await this.prisma.club.findFirst({
      where: { id: clubId, isActive: true }
    });

    if (!club) {
      throw new NotFoundException("Club was not found.");
    }

    const canManage = await this.authorizationService.canManageClub(principal, clubId);
    if (!canManage) {
      throw new ForbiddenException("You do not have permission to manage this club.");
    }

    const parsedPage = parseInt(query.page || "1", 10);
    const parsedPageSize = parseInt(query.pageSize || "20", 10);
    
    if (isNaN(parsedPage) || parsedPage < 1) {
      throw new BadRequestException("Invalid page.");
    }
    if (isNaN(parsedPageSize) || parsedPageSize < 1) {
      throw new BadRequestException("Invalid page size.");
    }
    
    const page = parsedPage;
    let pageSize = parsedPageSize;
    if (pageSize > 100) pageSize = 100;

    const q = query.q?.trim();
    const status = query.status;

    const where: Prisma.EventWhereInput = { clubId };

    if (status) {
      if (!EVENT_STATUSES.includes(status as EventStatus)) {
        throw new BadRequestException("Invalid event status.");
      }
      where.status = status as EventStatus;
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } }
      ];
    }

    const [totalItems, items, groupedStatuses] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.event.groupBy({
        by: ["status"],
        where: { clubId },
        _count: {
          _all: true
        }
      })
    ]);

    const statusCounts = {
      DRAFT: 0,
      SUBMITTED: 0,
      CHANGES_REQUESTED: 0,
      REJECTED: 0,
      APPROVED: 0,
      PUBLISHED: 0,
      CANCELLED: 0,
      COMPLETED: 0,
    };

    for (const group of groupedStatuses) {
      if (group.status in statusCounts) {
        statusCounts[group.status as keyof typeof statusCounts] = group._count._all;
      }
    }

    return {
      club: {
        id: club.id,
        name: club.name
      },
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize)
      },
      statusCounts
    };
  }

  private assertValidClubId(clubId: string): void {
    if (
      typeof clubId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        clubId
      )
    ) {
      throw new BadRequestException("Invalid club ID.");
    }
  }
}

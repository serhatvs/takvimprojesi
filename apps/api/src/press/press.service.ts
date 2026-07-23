import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { Principal } from "../auth/principal";
import { PrismaService } from "../prisma/prisma.service";
import type { PressEventsQueryDto } from "./dto/press-events-query.dto";

const PRESS_EVENT_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  startsAt: true,
  endsAt: true,
  location: true,
  capacity: true,
  createdAt: true,
  updatedAt: true,
  club: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.EventSelect;

@Injectable()
export class PressService {
  constructor(private readonly prisma: PrismaService) {}

  async listSubmittedEvents(principal: Principal, query: PressEventsQueryDto) {
    this.assertPressAccess(principal);

    const input = this.validatePressQuery(query);

    const where: Prisma.EventWhereInput = {
      status: "SUBMITTED"
    };

    if (input.q) {
      where.OR = [
        { title: { contains: input.q, mode: "insensitive" } },
        { description: { contains: input.q, mode: "insensitive" } },
        { club: { name: { contains: input.q, mode: "insensitive" } } }
      ];
    }

    const [totalItems, items] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        select: PRESS_EVENT_SELECT,
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      })
    ]);

    const mappedItems = items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      status: "SUBMITTED" as const,
      startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt.toISOString(),
      location: item.location,
      capacity: item.capacity,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      club: {
        id: item.club.id,
        name: item.club.name
      }
    }));

    return {
      items: mappedItems,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / input.pageSize) || 0
      }
    };
  }

  async listApprovedEvents(principal: Principal, query: PressEventsQueryDto) {
    this.assertPressAccess(principal);

    const input = this.validatePressQuery(query);

    const where: Prisma.EventWhereInput = {
      status: "APPROVED"
    };

    if (input.q) {
      where.OR = [
        { title: { contains: input.q, mode: "insensitive" } },
        { description: { contains: input.q, mode: "insensitive" } },
        { club: { name: { contains: input.q, mode: "insensitive" } } }
      ];
    }

    const [totalItems, items] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        select: {
          ...PRESS_EVENT_SELECT,
          publishedAt: true
        },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      })
    ]);

    const mappedItems = items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      status: "APPROVED" as const,
      startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt.toISOString(),
      location: item.location,
      capacity: item.capacity,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
      club: {
        id: item.club.id,
        name: item.club.name
      }
    }));

    return {
      items: mappedItems,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / input.pageSize) || 0
      }
    };
  }

  private assertPressAccess(principal: Principal): void {
    const isPress =
      principal.globalRoles.includes("PRESS_EDITOR") ||
      principal.globalRoles.includes("SYSTEM_ADMIN");

    if (!isPress) {
      throw new ForbiddenException("You are not allowed to access press events queue.");
    }
  }

  private validatePressQuery(query: PressEventsQueryDto) {
    const page = this.optionalPositiveInteger(query.page, "page") ?? 1;
    const pageSize = this.optionalPositiveInteger(query.pageSize, "pageSize") ?? 20;

    if (pageSize > 100) {
      throw new BadRequestException("pageSize must be less than or equal to 100.");
    }

    const q = typeof query.q === "string" ? query.q.trim() : "";

    return {
      page,
      pageSize,
      q: q.length > 0 ? q : null
    };
  }

  private optionalPositiveInteger(value: unknown, field: string): number | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const strValue = String(value).trim();
    if (!/^[1-9]\d*$/.test(strValue)) {
      throw new BadRequestException(`${field} must be a positive integer.`);
    }

    return Number(strValue);
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AuthorizationService } from "../auth/authorization.service";
import type { Principal } from "../auth/principal";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateDraftEventDto, ValidCreateDraftEventInput } from "./dto/create-draft-event.dto";

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService
  ) {}

  async createDraftEvent(principal: Principal, dto: CreateDraftEventDto) {
    const input = this.validateCreateDraftEvent(dto);
    const club = await this.prisma.club.findFirst({
      where: {
        id: input.clubId,
        isActive: true
      },
      select: { id: true }
    });

    if (!club) {
      throw new NotFoundException("Club was not found.");
    }

    const canCreate = await this.authorizationService.canCreateEventForClub(principal, input.clubId);
    if (!canCreate) {
      throw new ForbiddenException("You are not allowed to create events for this club.");
    }

    return this.prisma.event.create({
      data: {
        clubId: input.clubId,
        createdById: principal.userId,
        title: input.title,
        slug: this.createDraftSlug(input.title),
        description: input.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        location: input.location,
        capacity: input.capacity,
        status: "DRAFT"
      }
    });
  }

  private validateCreateDraftEvent(dto: CreateDraftEventDto): ValidCreateDraftEventInput {
    const clubId = this.requiredString(dto.clubId, "clubId");
    const title = this.requiredString(dto.title, "title");
    const description = this.requiredString(dto.description, "description");
    const location = this.requiredString(dto.location, "location");
    const startsAt = this.requiredIsoDate(dto.startsAt, "startsAt");
    const endsAt = this.requiredIsoDate(dto.endsAt, "endsAt");
    const capacity = this.optionalPositiveInteger(dto.capacity, "capacity");

    if (startsAt >= endsAt) {
      throw new BadRequestException("startsAt must be before endsAt.");
    }

    return {
      clubId,
      title,
      description,
      startsAt,
      endsAt,
      location,
      capacity
    };
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required.`);
    }

    return value.trim();
  }

  private requiredIsoDate(value: unknown, field: string): Date {
    if (typeof value !== "string" || !this.looksLikeIsoDate(value)) {
      throw new BadRequestException(`${field} must be a valid ISO-8601 date.`);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO-8601 date.`);
    }

    return date;
  }

  private optionalPositiveInteger(value: unknown, field: string): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${field} must be a positive integer.`);
    }

    return value;
  }

  private looksLikeIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  }

  private createDraftSlug(title: string): string {
    const slugBase = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    return `${slugBase || "event"}-${randomUUID().slice(0, 8)}`;
  }
}

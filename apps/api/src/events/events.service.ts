import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { EventReviewDecision, EventStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AuthorizationService } from "../auth/authorization.service";
import type { Principal } from "../auth/principal";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateDraftEventDto, ValidCreateDraftEventInput } from "./dto/create-draft-event.dto";
import { EventLifecycleService } from "./event-lifecycle.service";

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService,
    private readonly eventLifecycleService: EventLifecycleService
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

  async submitDraftEvent(principal: Principal, eventId: string) {
    this.assertValidEventId(eventId);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        clubId: true,
        status: true,
        createdById: true
      }
    });

    if (!event) {
      throw new NotFoundException("Event was not found.");
    }

    const canSubmit = await this.authorizationService.canSubmitEventForClub(
      principal,
      event.clubId
    );
    if (!canSubmit) {
      throw new ForbiddenException("You are not allowed to submit this event.");
    }

    const lifecycleRoles = principal.globalRoles.includes("SYSTEM_ADMIN")
      ? ["SYSTEM_ADMIN" as const]
      : ["CLUB_ADMIN" as const];

    try {
      this.eventLifecycleService.assertTransitionAllowed(event.status, "SUBMITTED", lifecycleRoles);
    } catch {
      throw new ConflictException("Only draft events can be submitted.");
    }

    return this.prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.event.updateMany({
        where: {
          id: eventId,
          status: "DRAFT"
        },
        data: {
          status: "SUBMITTED"
        }
      });

      if (updateResult.count !== 1) {
        throw new ConflictException("Only draft events can be submitted.");
      }

      await transaction.auditLog.create({
        data: {
          actorId: principal.userId,
          entityType: "Event",
          entityId: eventId,
          action: "EVENT_SUBMITTED",
          before: { status: "DRAFT" },
          after: { status: "SUBMITTED" },
          metadata: {
            clubId: event.clubId,
            transition: "DRAFT_TO_SUBMITTED"
          }
        }
      });

      return transaction.event.findUniqueOrThrow({
        where: { id: eventId }
      });
    });
  }

  async reviewEvent(
    principal: Principal,
    eventId: string,
    decision: EventReviewDecision,
    comment?: unknown
  ) {
    this.assertValidEventId(eventId);
    const normalizedComment = this.validateReviewComment(decision, comment);
    const nextStatus = this.statusForReviewDecision(decision);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        clubId: true,
        status: true,
        createdById: true
      }
    });

    if (!event) {
      throw new NotFoundException("Event was not found.");
    }

    if (!this.authorizationService.canReviewEvents(principal)) {
      throw new ForbiddenException("You are not allowed to review events.");
    }

    const lifecycleRoles = principal.globalRoles.includes("SYSTEM_ADMIN")
      ? ["SYSTEM_ADMIN" as const]
      : ["PRESS_EDITOR" as const];

    try {
      this.eventLifecycleService.assertTransitionAllowed(event.status, nextStatus, lifecycleRoles);
    } catch {
      throw new ConflictException("Only submitted events can be reviewed.");
    }

    return this.prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.event.updateMany({
        where: {
          id: eventId,
          status: "SUBMITTED"
        },
        data: {
          status: nextStatus
        }
      });

      if (updateResult.count !== 1) {
        throw new ConflictException("Only submitted events can be reviewed.");
      }

      await transaction.eventReview.create({
        data: {
          eventId,
          reviewerId: principal.userId,
          decision,
          comment: normalizedComment
        }
      });

      await transaction.auditLog.create({
        data: {
          actorId: principal.userId,
          entityType: "Event",
          entityId: eventId,
          action: this.auditActionForReviewDecision(decision),
          before: { status: "SUBMITTED" },
          after: { status: nextStatus },
          metadata: {
            decision
          }
        }
      });

      return transaction.event.findUniqueOrThrow({
        where: { id: eventId }
      });
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

  private assertValidEventId(eventId: string): void {
    if (
      typeof eventId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        eventId
      )
    ) {
      throw new BadRequestException("eventId must be a valid UUID.");
    }
  }

  private validateReviewComment(decision: EventReviewDecision, comment: unknown): string {
    if (decision === "APPROVED") {
      return typeof comment === "string" ? comment.trim() : "";
    }

    if (typeof comment !== "string" || comment.trim().length === 0) {
      throw new BadRequestException("comment is required.");
    }

    return comment.trim();
  }

  private statusForReviewDecision(decision: EventReviewDecision): EventStatus {
    switch (decision) {
      case "CHANGES_REQUESTED":
        return "CHANGES_REQUESTED";
      case "REJECTED":
        return "REJECTED";
      case "APPROVED":
        return "APPROVED";
    }
  }

  private auditActionForReviewDecision(decision: EventReviewDecision): string {
    switch (decision) {
      case "CHANGES_REQUESTED":
        return "EVENT_CHANGES_REQUESTED";
      case "REJECTED":
        return "EVENT_REJECTED";
      case "APPROVED":
        return "EVENT_APPROVED";
    }
  }
}

import {
  ATTENDANCE_CHECK_IN_CLOSES_MINUTES_AFTER_END,
  ATTENDANCE_CHECK_IN_OPENS_MINUTES_BEFORE_START,
  ATTENDANCE_TOKEN_TTL_MINUTES
} from "@agu/config";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { EventReviewDecision, EventStatus, Prisma } from "@prisma/client";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { AuthorizationService } from "../auth/authorization.service";
import type { Principal } from "../auth/principal";
import { PrismaService } from "../prisma/prisma.service";
import {
  ATTENDANCE_SUMMARY_EVENT_STATUSES,
  calculateAttendanceSummaryMetrics
} from "./attendance-summary";
import type { AttendanceSummaryQueryDto } from "./dto/attendance-summary-query.dto";
import type { CreateDraftEventDto, ValidCreateDraftEventInput } from "./dto/create-draft-event.dto";
import type { PublicEventsQueryDto } from "./dto/public-events-query.dto";
import { EventLifecycleService } from "./event-lifecycle.service";

const PUBLIC_EVENT_SELECT = {
  id: true,
  title: true,
  description: true,
  startsAt: true,
  endsAt: true,
  location: true,
  capacity: true,
  status: true,
  participationScope: true,
  publishedAt: true,
  club: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  }
} satisfies Prisma.EventSelect;

const MILLISECONDS_PER_MINUTE = 60 * 1000;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService,
    private readonly eventLifecycleService: EventLifecycleService
  ) {}

  async listPublicEvents(query: PublicEventsQueryDto) {
    const input = this.validatePublicEventsQuery(query);
    const where = this.createPublicEventsWhere(input);
    const [totalItems, items] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        select: PUBLIC_EVENT_SELECT,
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      })
    ]);

    return {
      items,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / input.pageSize)
      }
    };
  }

  async getPublicEvent(eventId: string) {
    this.assertValidEventId(eventId);

    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        status: "PUBLISHED"
      },
      select: PUBLIC_EVENT_SELECT
    });

    if (!event) {
      throw new NotFoundException("Event was not found.");
    }

    return event;
  }

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
        status: "DRAFT",
        participationScope: input.participationScope
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
      throw new ConflictException("Only draft or changes_requested events can be submitted.");
    }

    const previousStatus = event.status;

    return this.prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.event.updateMany({
        where: {
          id: eventId,
          status: previousStatus
        },
        data: {
          status: "SUBMITTED"
        }
      });

      if (updateResult.count !== 1) {
        throw new ConflictException("Only draft or changes_requested events can be submitted.");
      }

      const auditAction = previousStatus === "CHANGES_REQUESTED" ? "EVENT_RESUBMITTED" : "EVENT_SUBMITTED";

      await transaction.auditLog.create({
        data: {
          actorId: principal.userId,
          entityType: "Event",
          entityId: eventId,
          action: auditAction,
          before: { status: previousStatus },
          after: { status: "SUBMITTED" },
          metadata: {
            clubId: event.clubId,
            transition: `${previousStatus}_TO_SUBMITTED`
          }
        }
      });

      return transaction.event.findUniqueOrThrow({
        where: { id: eventId }
      });
    });
  }

  async getEventRevision(principal: Principal, eventId: string) {
    this.assertValidEventId(eventId);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        clubId: true,
        title: true,
        description: true,
        status: true,
        participationScope: true,
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
      }
    });

    if (!event) {
      throw new NotFoundException("Event was not found.");
    }

    const canManage = await this.authorizationService.canManageClub(principal, event.clubId);
    if (!canManage) {
      throw new ForbiddenException("You are not allowed to access this event revision.");
    }

    if (event.status !== "CHANGES_REQUESTED") {
      throw new ConflictException("Event is not in CHANGES_REQUESTED status.");
    }

    const latestReview = await this.prisma.eventReview.findFirst({
      where: {
        eventId,
        decision: "CHANGES_REQUESTED"
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        comment: true,
        createdAt: true
      }
    });

    return {
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        status: "CHANGES_REQUESTED" as const,
        participationScope: event.participationScope,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        location: event.location,
        capacity: event.capacity,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        club: {
          id: event.club.id,
          name: event.club.name
        }
      },
      latestChangeRequest: latestReview
        ? {
            comment: latestReview.comment,
            createdAt: latestReview.createdAt.toISOString()
          }
        : null
    };
  }

  async updateEventRevision(
    principal: Principal,
    eventId: string,
    dto: import("./dto/update-event-revision.dto").UpdateEventRevisionDto
  ) {
    this.assertValidEventId(eventId);
    const input = this.validateUpdateEventRevision(dto);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        clubId: true,
        status: true
      }
    });

    if (!event) {
      throw new NotFoundException("Event was not found.");
    }

    const canManage = await this.authorizationService.canManageClub(principal, event.clubId);
    if (!canManage) {
      throw new ForbiddenException("You are not allowed to edit this event revision.");
    }

    if (event.status !== "CHANGES_REQUESTED") {
      throw new ConflictException("Event is not in CHANGES_REQUESTED status.");
    }

    return this.prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.event.updateMany({
        where: {
          id: eventId,
          status: "CHANGES_REQUESTED"
        },
        data: {
          title: input.title,
          description: input.description,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          location: input.location,
          capacity: input.capacity,
          participationScope: input.participationScope
        }
      });

      if (updateResult.count !== 1) {
        throw new ConflictException("Event is not in CHANGES_REQUESTED status.");
      }

      await transaction.auditLog.create({
        data: {
          actorId: principal.userId,
          entityType: "Event",
          entityId: eventId,
          action: "EVENT_REVISION_UPDATED",
          before: { status: "CHANGES_REQUESTED" },
          after: { status: "CHANGES_REQUESTED" },
          metadata: {
            updatedFields: [
              "title",
              "description",
              "startsAt",
              "endsAt",
              "location",
              "capacity",
              "participationScope"
            ]
          }
        }
      });

      return transaction.event.findUniqueOrThrow({
        where: { id: eventId }
      });
    });
  }

  async cancelEvent(
    principal: Principal,
    eventId: string,
    dto: import("./dto/cancel-event.dto").CancelEventDto
  ) {
    this.assertValidEventId(eventId);

    const keys = Object.keys(dto || {});
    if (keys.length === 0 || keys.some((k) => k !== "reason")) {
      throw new BadRequestException("Only reason parameter is allowed.");
    }

    if (typeof dto.reason !== "string") {
      throw new BadRequestException("reason must be a string.");
    }
    const trimmedReason = dto.reason.trim();
    if (trimmedReason.length < 5 || trimmedReason.length > 500) {
      throw new BadRequestException("reason must be between 5 and 500 characters.");
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        clubId: true,
        status: true,
        publishedAt: true
      }
    });

    if (!event) {
      throw new NotFoundException("Event was not found.");
    }

    const canManage = await this.authorizationService.canManageClub(principal, event.clubId);
    if (!canManage) {
      throw new ForbiddenException("You are not allowed to cancel events for this club.");
    }

    const allowedStartingStatuses = ["SUBMITTED", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED"];
    if (!allowedStartingStatuses.includes(event.status)) {
      throw new ConflictException("Event cannot be cancelled in its current status.");
    }

    const lifecycleRoles = principal.globalRoles.includes("SYSTEM_ADMIN")
      ? ["SYSTEM_ADMIN" as const]
      : ["CLUB_ADMIN" as const];

    try {
      this.eventLifecycleService.assertTransitionAllowed(event.status, "CANCELLED", lifecycleRoles);
    } catch {
      throw new ConflictException("Event cannot be cancelled in its current status.");
    }

    const previousStatus = event.status;
    return this.prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.event.updateMany({
        where: {
          id: eventId,
          status: previousStatus
        },
        data: {
          status: "CANCELLED",
          qrTokenHash: null,
          qrTokenExpiresAt: null
        }
      });

      if (updateResult.count !== 1) {
        throw new ConflictException("Event cannot be cancelled in its current status.");
      }

      await transaction.auditLog.create({
        data: {
          actorId: principal.userId,
          entityType: "Event",
          entityId: eventId,
          action: "EVENT_CANCELLED",
          before: { status: previousStatus },
          after: { status: "CANCELLED" },
          metadata: {
            reason: trimmedReason
          }
        }
      });

      return transaction.event.findUniqueOrThrow({
        where: { id: eventId }
      });
    });
  }

  async completeEvent(principal: Principal, eventId: string) {
    this.assertValidEventId(eventId);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        clubId: true,
        status: true,
        endsAt: true
      }
    });

    if (!event) {
      throw new NotFoundException("Event was not found.");
    }

    const canManage = await this.authorizationService.canManageClub(principal, event.clubId);
    if (!canManage) {
      throw new ForbiddenException("You are not allowed to complete events for this club.");
    }

    if (event.status !== "PUBLISHED") {
      throw new ConflictException("Only published events can be completed.");
    }

    const now = new Date();
    if (event.endsAt > now) {
      throw new ConflictException("Event cannot be completed before its end time.");
    }

    const lifecycleRoles = principal.globalRoles.includes("SYSTEM_ADMIN")
      ? ["SYSTEM_ADMIN" as const]
      : ["CLUB_ADMIN" as const];

    try {
      this.eventLifecycleService.assertTransitionAllowed(event.status, "COMPLETED", lifecycleRoles);
    } catch {
      throw new ConflictException("Only published events can be completed.");
    }

    return this.prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.event.updateMany({
        where: {
          id: eventId,
          status: "PUBLISHED",
          endsAt: { lte: now }
        },
        data: {
          status: "COMPLETED",
          qrTokenHash: null,
          qrTokenExpiresAt: null
        }
      });

      if (updateResult.count !== 1) {
        throw new ConflictException("Event cannot be completed before its end time or is not in PUBLISHED status.");
      }

      await transaction.auditLog.create({
        data: {
          actorId: principal.userId,
          entityType: "Event",
          entityId: eventId,
          action: "EVENT_COMPLETED",
          before: { status: "PUBLISHED" },
          after: { status: "COMPLETED" }
        }
      });

      return transaction.event.findUniqueOrThrow({
        where: { id: eventId }
      });
    });
  }

  private validateUpdateEventRevision(
    dto: import("./dto/update-event-revision.dto").UpdateEventRevisionDto
  ): import("./dto/update-event-revision.dto").ValidUpdateEventRevisionInput {
    const title = this.requiredString(dto.title, "title");
    const description = this.requiredString(dto.description, "description");
    const location = this.requiredString(dto.location, "location");
    const startsAt = this.requiredIsoDate(dto.startsAt, "startsAt");
    const endsAt = this.requiredIsoDate(dto.endsAt, "endsAt");
    const capacity = this.optionalPositiveInteger(dto.capacity, "capacity");
    const participationScope = this.validateParticipationScope(dto.participationScope);

    if (startsAt >= endsAt) {
      throw new BadRequestException("startsAt must be before endsAt.");
    }

    return {
      title,
      description,
      startsAt,
      endsAt,
      location,
      capacity,
      participationScope
    };
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

  async publishEvent(principal: Principal, eventId: string) {
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

    if (!this.authorizationService.canPublishEvents(principal)) {
      throw new ForbiddenException("You are not allowed to publish events.");
    }

    const lifecycleRoles = principal.globalRoles.includes("SYSTEM_ADMIN")
      ? ["SYSTEM_ADMIN" as const]
      : ["PRESS_EDITOR" as const];

    try {
      this.eventLifecycleService.assertTransitionAllowed(event.status, "PUBLISHED", lifecycleRoles);
    } catch {
      throw new ConflictException("Only approved events can be published.");
    }

    return this.prisma.$transaction(async (transaction) => {
      const publishedAt = new Date();
      const updateResult = await transaction.event.updateMany({
        where: {
          id: eventId,
          status: "APPROVED"
        },
        data: {
          status: "PUBLISHED",
          publishedAt
        }
      });

      if (updateResult.count !== 1) {
        throw new ConflictException("Only approved events can be published.");
      }

      await transaction.auditLog.create({
        data: {
          actorId: principal.userId,
          entityType: "Event",
          entityId: eventId,
          action: "EVENT_PUBLISHED",
          before: { status: "APPROVED" },
          after: { status: "PUBLISHED" },
          metadata: {
            publishedAt: publishedAt.toISOString()
          }
        }
      });

      return transaction.event.findUniqueOrThrow({
        where: { id: eventId }
      });
    });
  }

  async registerForEvent(principal: Principal, eventId: string) {
    this.assertValidEventId(eventId);

    const isStudent = principal.globalRoles.includes("STUDENT");
    const isExternal = principal.globalRoles.includes("EXTERNAL_PARTICIPANT");

    if (!isStudent && !isExternal) {
      throw new ForbiddenException("Only students and external participants can register for events.");
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;

        const event = await transaction.event.findFirst({
          where: {
            id: eventId,
            status: "PUBLISHED"
          },
          select: {
            id: true,
            startsAt: true,
            capacity: true,
            participationScope: true
          }
        });

        if (!event) {
          throw new NotFoundException("Event was not found.");
        }

        if (event.participationScope === "AGU_ONLY" && !isStudent) {
          throw new ForbiddenException("This event is restricted to AGU students.");
        }

        if (event.startsAt <= new Date()) {
          throw new ConflictException("Registration is closed for started events.");
        }

        const existingRegistration = await transaction.eventRegistration.findUnique({
          where: {
            eventId_userId: {
              eventId,
              userId: principal.userId
            }
          },
          select: { id: true }
        });

        if (existingRegistration) {
          throw new ConflictException("User is already registered for this event.");
        }

        if (event.capacity !== null) {
          const registrationCount = await transaction.eventRegistration.count({
            where: { eventId }
          });

          if (registrationCount >= event.capacity) {
            throw new ConflictException("Event capacity is full.");
          }
        }

        return transaction.eventRegistration.create({
          data: {
            eventId,
            userId: principal.userId
          }
        });
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("User is already registered for this event.");
      }

      throw error;
    }
  }

  async getEventRegistrationStatus(principal: Principal, eventId: string) {
    this.assertValidEventId(eventId);

    const isStudent = principal.globalRoles.includes("STUDENT");
    const isExternal = principal.globalRoles.includes("EXTERNAL_PARTICIPANT");

    if (!isStudent && !isExternal) {
      throw new ForbiddenException("Only students or external participants can view registration status.");
    }

    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        status: "PUBLISHED"
      },
      select: {
        id: true,
        participationScope: true,
        startsAt: true,
        capacity: true
      }
    });

    if (!event) {
      throw new NotFoundException("Event was not found.");
    }

    const registration = await this.prisma.eventRegistration.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId: principal.userId
        }
      }
    });

    const isEligible =
      event.participationScope === "AGU_ONLY" ? isStudent : isStudent || isExternal;

    let eligibilityCode: import("@agu/contracts").RegistrationEligibilityCode = "eligible";

    if (registration) {
      eligibilityCode = "registered";
    } else if (!isEligible) {
      eligibilityCode = "not-eligible";
    } else if (event.startsAt <= new Date()) {
      eligibilityCode = "registration-closed";
    }

    return {
      registered: registration !== null,
      eligible: isEligible,
      eligibilityCode,
      registration
    };
  }

  async issueAttendanceToken(principal: Principal, eventId: string) {
    this.assertValidEventId(eventId);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        clubId: true,
        status: true
      }
    });

    if (!event) {
      throw new NotFoundException("Event was not found.");
    }

    const canIssue = await this.authorizationService.canIssueAttendanceTokenForClub(
      principal,
      event.clubId
    );
    if (!canIssue) {
      throw new ForbiddenException("You are not allowed to issue attendance tokens.");
    }

    if (event.status !== "PUBLISHED") {
      throw new ConflictException("Only published events can receive attendance tokens.");
    }

    const token = this.createAttendanceToken();
    const expiresAt = new Date(Date.now() + ATTENDANCE_TOKEN_TTL_MINUTES * MILLISECONDS_PER_MINUTE);
    const tokenHash = this.hashAttendanceToken(token);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.event.update({
        where: { id: eventId },
        data: {
          qrTokenHash: tokenHash,
          qrTokenExpiresAt: expiresAt
        },
        select: { id: true }
      });

      await transaction.auditLog.create({
        data: {
          actorId: principal.userId,
          entityType: "Event",
          entityId: eventId,
          action: "EVENT_ATTENDANCE_TOKEN_ISSUED",
          metadata: {
            expiresAt: expiresAt.toISOString(),
            ttlMinutes: ATTENDANCE_TOKEN_TTL_MINUTES
          }
        }
      });
    });

    return {
      eventId,
      token,
      expiresAt
    };
  }

  async checkInWithAttendanceToken(principal: Principal, eventId: string, token: unknown) {
    this.assertValidEventId(eventId);
    const inputToken = this.requiredString(token, "token");

    if (!principal.globalRoles.includes("STUDENT")) {
      throw new ForbiddenException("Only students can check in to events.");
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const event = await transaction.event.findFirst({
          where: {
            id: eventId,
            status: "PUBLISHED"
          },
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            qrTokenHash: true,
            qrTokenExpiresAt: true
          }
        });

        if (!event) {
          throw new NotFoundException("Event was not found.");
        }

        const registration = await transaction.eventRegistration.findUnique({
          where: {
            eventId_userId: {
              eventId,
              userId: principal.userId
            }
          },
          select: {
            id: true,
            cancelledAt: true
          }
        });

        if (!registration || registration.cancelledAt) {
          throw new ForbiddenException("You must be registered for this event to check in.");
        }

        const now = new Date();
        if (!this.isWithinAttendanceWindow(event.startsAt, event.endsAt, now)) {
          throw new ConflictException("Check-in is not open for this event.");
        }

        if (
          !event.qrTokenHash ||
          !event.qrTokenExpiresAt ||
          event.qrTokenExpiresAt <= now ||
          !this.isAttendanceTokenValid(inputToken, event.qrTokenHash)
        ) {
          throw new BadRequestException("Attendance token is invalid or expired.");
        }

        return transaction.attendance.create({
          data: {
            eventId,
            userId: principal.userId,
            source: "QR"
          }
        });
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("User has already checked in for this event.");
      }

      throw error;
    }
  }

  async getAttendanceSummary(
    principal: Principal,
    eventId: string,
    query?: AttendanceSummaryQueryDto
  ) {
    this.assertValidEventId(eventId);

    const page = this.optionalPositiveIntegerString(query?.page, "page") ?? 1;
    const pageSize = this.optionalPositiveIntegerString(query?.pageSize, "pageSize") ?? 50;
    if (pageSize > 100) {
      throw new BadRequestException("pageSize must be less than or equal to 100.");
    }
    const q = this.optionalTrimmedString(query?.q);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        clubId: true,
        title: true,
        status: true,
        startsAt: true,
        endsAt: true,
        capacity: true
      }
    });

    if (!event) {
      throw new NotFoundException("Event was not found.");
    }

    const canView = await this.authorizationService.canViewAttendanceSummaryForClub(
      principal,
      event.clubId
    );
    if (!canView) {
      throw new ForbiddenException("You are not allowed to view attendance summary.");
    }

    if (!ATTENDANCE_SUMMARY_EVENT_STATUSES.includes(event.status)) {
      throw new ConflictException("Attendance summary is not available for this event status.");
    }

    const [registrationCount, totalAttendanceCount] = await this.prisma.$transaction([
      this.prisma.eventRegistration.count({
        where: {
          eventId,
          cancelledAt: null
        }
      }),
      this.prisma.attendance.count({
        where: { eventId }
      })
    ]);

    const attendeeWhere: Prisma.AttendanceWhereInput = {
      eventId
    };

    if (q && q.length > 0) {
      attendeeWhere.OR = [
        { user: { displayName: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } }
      ];
    }

    const [totalMatchingAttendees, attendances] = await this.prisma.$transaction([
      this.prisma.attendance.count({ where: attendeeWhere }),
      this.prisma.attendance.findMany({
        where: attendeeWhere,
        select: {
          userId: true,
          checkedInAt: true,
          user: {
            select: {
              displayName: true,
              email: true,
              roles: {
                select: { role: true }
              },
              registrations: {
                where: { eventId, cancelledAt: null },
                select: { registeredAt: true },
                take: 1
              }
            }
          }
        },
        orderBy: [
          { checkedInAt: "asc" },
          { id: "asc" }
        ],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    const attendees = attendances.map((att) => {
      const roles = att.user.roles.map((r) => r.role);
      const isExternal = roles.includes("EXTERNAL_PARTICIPANT") && !roles.includes("STUDENT");
      return {
        userId: att.userId,
        displayName: att.user.displayName,
        email: att.user.email,
        registeredAt: (att.user.registrations[0]?.registeredAt ?? att.checkedInAt).toISOString(),
        checkedInAt: att.checkedInAt.toISOString(),
        participantType: isExternal ? ("EXTERNAL" as const) : ("AGU" as const)
      };
    });

    return {
      event,
      metrics: calculateAttendanceSummaryMetrics({
        registrationCount,
        attendanceCount: totalAttendanceCount,
        capacity: event.capacity
      }),
      attendees,
      pagination: {
        page,
        pageSize,
        totalItems: totalMatchingAttendees,
        totalPages: Math.max(1, Math.ceil(totalMatchingAttendees / pageSize))
      },
      generatedAt: new Date()
    };
  }

  private validateCreateDraftEvent(dto: CreateDraftEventDto): ValidCreateDraftEventInput {
    const clubId = this.requiredString(dto.clubId, "clubId");
    const title = this.requiredString(dto.title, "title");
    const description = this.requiredString(dto.description, "description");
    const location = this.requiredString(dto.location, "location");
    const startsAt = this.requiredIsoDate(dto.startsAt, "startsAt");
    const endsAt = this.requiredIsoDate(dto.endsAt, "endsAt");
    const capacity = this.optionalPositiveInteger(dto.capacity, "capacity");
    const participationScope = this.validateParticipationScope(dto.participationScope);

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
      capacity,
      participationScope
    };
  }

  private validateParticipationScope(
    value: unknown
  ): import("@agu/contracts").EventParticipationScope {
    if (value === undefined || value === null || value === "") {
      return "AGU_ONLY";
    }

    if (
      typeof value !== "string" ||
      !["AGU_ONLY", "EXTERNAL_ALLOWED"].includes(value)
    ) {
      throw new BadRequestException("participationScope must be AGU_ONLY or EXTERNAL_ALLOWED.");
    }

    return value as import("@agu/contracts").EventParticipationScope;
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

  private validatePublicEventsQuery(query: PublicEventsQueryDto) {
    const from = this.optionalIsoDate(query.from, "from") ?? new Date();
    const to = this.optionalIsoDate(query.to, "to");
    if (to && from > to) {
      throw new BadRequestException("from must be before or equal to to.");
    }

    const page = this.optionalPositiveIntegerString(query.page, "page") ?? 1;
    const pageSize = this.optionalPositiveIntegerString(query.pageSize, "pageSize") ?? 20;
    if (pageSize > 100) {
      throw new BadRequestException("pageSize must be less than or equal to 100.");
    }

    return {
      from,
      to,
      clubId: this.optionalTrimmedString(query.clubId),
      q: this.optionalTrimmedString(query.q),
      page,
      pageSize
    };
  }

  private createPublicEventsWhere(input: {
    from: Date;
    to: Date | null;
    clubId: string | null;
    q: string | null;
  }): Prisma.EventWhereInput {
    const where: Prisma.EventWhereInput = {
      status: "PUBLISHED",
      startsAt: {
        gte: input.from,
        ...(input.to ? { lte: input.to } : {})
      }
    };

    if (input.clubId) {
      where.clubId = input.clubId;
    }

    if (input.q) {
      where.OR = [
        { title: { contains: input.q, mode: "insensitive" } },
        { description: { contains: input.q, mode: "insensitive" } }
      ];
    }

    return where;
  }

  private optionalIsoDate(value: unknown, field: string): Date | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    return this.requiredIsoDate(value, field);
  }

  private optionalTrimmedString(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private optionalPositiveIntegerString(value: unknown, field: string): number | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
      throw new BadRequestException(`${field} must be a positive integer.`);
    }

    return Number(value);
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

  private createAttendanceToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private hashAttendanceToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }

  private isAttendanceTokenValid(token: string, expectedHash: string): boolean {
    const actualHash = this.hashAttendanceToken(token);
    const actual = Buffer.from(actualHash, "hex");
    const expected = Buffer.from(expectedHash, "hex");

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private isWithinAttendanceWindow(startsAt: Date, endsAt: Date, now: Date): boolean {
    const opensAt = new Date(
      startsAt.getTime() -
        ATTENDANCE_CHECK_IN_OPENS_MINUTES_BEFORE_START * MILLISECONDS_PER_MINUTE
    );
    const closesAt = new Date(
      endsAt.getTime() + ATTENDANCE_CHECK_IN_CLOSES_MINUTES_AFTER_END * MILLISECONDS_PER_MINUTE
    );

    return now >= opensAt && now <= closesAt;
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

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    );
  }
}

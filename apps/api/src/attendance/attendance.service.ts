import {
  ATTENDANCE_CHECK_IN_CLOSES_MINUTES_AFTER_END,
  ATTENDANCE_CHECK_IN_OPENS_MINUTES_BEFORE_START
} from "@agu/config";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthorizationService } from "../auth/authorization.service";
import type { Principal } from "../auth/principal";
import { PrismaService } from "../prisma/prisma.service";
import { AttendanceTokenService } from "./attendance-token.service";

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService,
    private readonly attendanceTokenService: AttendanceTokenService
  ) {}

  private assertValidEventId(eventId: string): void {
    if (typeof eventId !== "string" || !UUID_V4_REGEX.test(eventId)) {
      throw new BadRequestException("Invalid eventId format.");
    }
  }

  private isWithinAttendanceWindow(startsAt: Date, endsAt: Date, now: Date = new Date()): boolean {
    const windowStart = new Date(
      startsAt.getTime() - ATTENDANCE_CHECK_IN_OPENS_MINUTES_BEFORE_START * MILLISECONDS_PER_MINUTE
    );
    const windowEnd = new Date(
      endsAt.getTime() + ATTENDANCE_CHECK_IN_CLOSES_MINUTES_AFTER_END * MILLISECONDS_PER_MINUTE
    );

    return now >= windowStart && now <= windowEnd;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
      (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002")
    );
  }

  async issueAttendanceToken(principal: Principal, eventId: string) {
    this.assertValidEventId(eventId);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        clubId: true,
        status: true,
        startsAt: true,
        endsAt: true
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

    const now = new Date();
    if (!this.isWithinAttendanceWindow(event.startsAt, event.endsAt, now)) {
      throw new ConflictException("Attendance window is not open for this event.");
    }

    const { token, expiresAt } = this.attendanceTokenService.generateAttendanceToken(eventId);

    return {
      eventId,
      token,
      expiresAt
    };
  }

  async checkIn(principal: Principal, inputToken: unknown) {
    if (!principal.globalRoles.includes("STUDENT")) {
      throw new ForbiddenException("Only students can check in to events.");
    }

    if (typeof inputToken !== "string" || !inputToken.trim()) {
      throw new BadRequestException("Attendance token is required.");
    }

    const payload = this.attendanceTokenService.verifyAttendanceToken(inputToken.trim());
    const eventId = payload.eventId;

    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        status: "PUBLISHED"
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true
      }
    });

    if (!event) {
      throw new NotFoundException("Event was not found.");
    }

    const now = new Date();
    if (!this.isWithinAttendanceWindow(event.startsAt, event.endsAt, now)) {
      throw new ConflictException("Attendance window is not open for this event.");
    }

    const registration = await this.prisma.eventRegistration.findUnique({
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
      throw new ConflictException("You must be registered for this event to check in.");
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const attendance = await transaction.attendance.create({
          data: {
            eventId,
            userId: principal.userId,
            source: "QR"
          }
        });

        await transaction.auditLog.create({
          data: {
            actorId: principal.userId,
            entityType: "Event",
            entityId: eventId,
            action: "EVENT_ATTENDANCE_RECORDED",
            metadata: {
              attendanceId: attendance.id
            }
          }
        });

        return attendance;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("User has already checked in for this event.");
      }

      throw error;
    }
  }
}

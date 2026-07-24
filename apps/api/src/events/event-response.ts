import type { Attendance, Event, EventRegistration } from "@prisma/client";
import type {
  AttendanceResponse,
  AttendanceTokenResponse,
  DraftEventResponse,
  EventAttendanceSummaryResponse,
  EventRegistrationResponse,
  EventResponse,
  PublicEventDetailResponse,
  PublicEventListItem
} from "@agu/contracts";
import type { AttendanceSummaryMetrics } from "./attendance-summary";

export type PublicEventRecord = Pick<
  Event,
  "id" | "title" | "description" | "startsAt" | "endsAt" | "location" | "capacity" | "status" | "publishedAt"
> & {
  club: {
    id: string;
    name: string;
    slug: string;
  };
};

export function toEventResponse(event: Event): EventResponse {
  return {
    id: event.id,
    clubId: event.clubId,
    createdById: event.createdById,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    location: event.location,
    capacity: event.capacity,
    status: event.status,
    publishedAt: event.publishedAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString()
  };
}

export function toDraftEventResponse(event: Event): DraftEventResponse {
  return {
    ...toEventResponse(event),
    status: "DRAFT"
  };
}

export function toPublicEventListItem(event: PublicEventRecord): PublicEventListItem {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    location: event.location,
    capacity: event.capacity,
    status: "PUBLISHED",
    publishedAt: event.publishedAt?.toISOString() ?? null,
    club: {
      id: event.club.id,
      name: event.club.name,
      slug: event.club.slug
    }
  };
}

export function toPublicEventDetailResponse(
  event: PublicEventRecord
): PublicEventDetailResponse {
  return toPublicEventListItem(event);
}

export function toEventRegistrationResponse(
  registration: EventRegistration
): EventRegistrationResponse {
  return {
    id: registration.id,
    eventId: registration.eventId,
    userId: registration.userId,
    registeredAt: registration.registeredAt.toISOString()
  };
}

export function toAttendanceTokenResponse(input: {
  eventId: string;
  token: string;
  expiresAt: Date;
}): AttendanceTokenResponse {
  return {
    eventId: input.eventId,
    token: input.token,
    expiresAt: input.expiresAt.toISOString()
  };
}

export function toAttendanceResponse(attendance: Attendance): AttendanceResponse {
  return {
    id: attendance.id,
    eventId: attendance.eventId,
    userId: attendance.userId,
    checkedInAt: attendance.checkedInAt.toISOString()
  };
}

export function toEventAttendanceSummaryResponse(input: {
  event: Pick<Event, "id" | "title" | "status" | "startsAt" | "endsAt" | "capacity">;
  metrics: AttendanceSummaryMetrics;
  attendees: Array<{
    userId: string;
    displayName: string;
    email: string;
    registeredAt: string;
    checkedInAt: string;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  generatedAt?: Date;
}): EventAttendanceSummaryResponse {
  return {
    event: {
      id: input.event.id,
      title: input.event.title,
      status: input.event.status,
      startsAt: input.event.startsAt.toISOString(),
      endsAt: input.event.endsAt.toISOString(),
      capacity: input.event.capacity
    },
    summary: input.metrics,
    metrics: input.metrics,
    attendees: input.attendees,
    pagination: input.pagination,
    ...(input.generatedAt ? { generatedAt: input.generatedAt.toISOString() } : {})
  };
}

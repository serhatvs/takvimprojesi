import type { Event, EventRegistration } from "@prisma/client";
import type {
  DraftEventResponse,
  EventRegistrationResponse,
  EventResponse,
  PublicEventDetailResponse,
  PublicEventListItem
} from "@agu/contracts";

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

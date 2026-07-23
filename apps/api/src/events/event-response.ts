import type { Event } from "@prisma/client";
import type { DraftEventResponse, EventResponse } from "@agu/contracts";

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

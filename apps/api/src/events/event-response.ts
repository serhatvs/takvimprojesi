import type { Event } from "@prisma/client";
import type { DraftEventResponse } from "@agu/contracts";

export function toDraftEventResponse(event: Event): DraftEventResponse {
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
    status: "DRAFT",
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString()
  };
}

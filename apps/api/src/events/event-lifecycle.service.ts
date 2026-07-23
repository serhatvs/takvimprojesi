import { canTransitionEvent, type EventStatus, type UserRole } from "@agu/contracts";
import { Injectable, UnprocessableEntityException } from "@nestjs/common";

@Injectable()
export class EventLifecycleService {
  assertTransitionAllowed(
    from: EventStatus,
    to: EventStatus,
    actorRoles: readonly UserRole[]
  ): void {
    if (!canTransitionEvent(from, to, actorRoles)) {
      throw new UnprocessableEntityException(
        `Event transition ${from} -> ${to} is not allowed for actor roles.`
      );
    }
  }
}

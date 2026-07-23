import type { EventStatus, UserRole } from "./index";

export type EventTransition = {
  from: EventStatus;
  to: EventStatus;
  roles: readonly UserRole[];
};

export const EVENT_TRANSITIONS: readonly EventTransition[] = [
  { from: "DRAFT", to: "SUBMITTED", roles: ["CLUB_ADMIN", "SYSTEM_ADMIN"] },
  { from: "SUBMITTED", to: "CHANGES_REQUESTED", roles: ["PRESS_EDITOR", "SYSTEM_ADMIN"] },
  { from: "SUBMITTED", to: "REJECTED", roles: ["PRESS_EDITOR", "SYSTEM_ADMIN"] },
  { from: "SUBMITTED", to: "APPROVED", roles: ["PRESS_EDITOR", "SYSTEM_ADMIN"] },
  { from: "CHANGES_REQUESTED", to: "SUBMITTED", roles: ["CLUB_ADMIN", "SYSTEM_ADMIN"] },
  { from: "APPROVED", to: "PUBLISHED", roles: ["PRESS_EDITOR", "SYSTEM_ADMIN"] },
  { from: "PUBLISHED", to: "COMPLETED", roles: ["CLUB_ADMIN", "SYSTEM_ADMIN"] },
  { from: "DRAFT", to: "CANCELLED", roles: ["CLUB_ADMIN"] },
  { from: "SUBMITTED", to: "CANCELLED", roles: ["CLUB_ADMIN", "SYSTEM_ADMIN"] },
  { from: "CHANGES_REQUESTED", to: "CANCELLED", roles: ["CLUB_ADMIN", "SYSTEM_ADMIN"] },
  { from: "APPROVED", to: "CANCELLED", roles: ["CLUB_ADMIN", "SYSTEM_ADMIN"] },
  { from: "PUBLISHED", to: "CANCELLED", roles: ["CLUB_ADMIN", "SYSTEM_ADMIN"] }
] as const;

export function canTransitionEvent(
  from: EventStatus,
  to: EventStatus,
  roles: readonly UserRole[]
): boolean {
  return EVENT_TRANSITIONS.some(
    (transition) =>
      transition.from === from &&
      transition.to === to &&
      transition.roles.some((role) => roles.includes(role))
  );
}

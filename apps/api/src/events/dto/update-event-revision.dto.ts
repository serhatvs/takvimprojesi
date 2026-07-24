import type { EventParticipationScope } from "@agu/contracts";

export type UpdateEventRevisionDto = {
  [key: string]: unknown;
  title?: unknown;
  description?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  location?: unknown;
  capacity?: unknown;
  participationScope?: unknown;
};

export type ValidUpdateEventRevisionInput = {
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  location: string;
  capacity: number | null;
  participationScope: EventParticipationScope;
};

import type { EventParticipationScope } from "@agu/contracts";

export type CreateDraftEventDto = {
  [key: string]: unknown;
  clubId?: unknown;
  title?: unknown;
  description?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  location?: unknown;
  capacity?: unknown;
  participationScope?: unknown;
};

export type ValidCreateDraftEventInput = {
  clubId: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  location: string;
  capacity: number | null;
  participationScope: EventParticipationScope;
};

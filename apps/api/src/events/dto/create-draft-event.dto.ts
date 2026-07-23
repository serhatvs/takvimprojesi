export type CreateDraftEventDto = {
  [key: string]: unknown;
  clubId?: unknown;
  title?: unknown;
  description?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  location?: unknown;
  capacity?: unknown;
};

export type ValidCreateDraftEventInput = {
  clubId: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  location: string;
  capacity: number | null;
};

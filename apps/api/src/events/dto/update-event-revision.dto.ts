export type UpdateEventRevisionDto = {
  [key: string]: unknown;
  title?: unknown;
  description?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  location?: unknown;
  capacity?: unknown;
};

export type ValidUpdateEventRevisionInput = {
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  location: string;
  capacity: number | null;
};

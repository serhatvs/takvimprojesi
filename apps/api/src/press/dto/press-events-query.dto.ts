import type { PressEventsQueryParams } from "@agu/contracts";

export type PressEventsQueryDto = PressEventsQueryParams & {
  [key: string]: unknown;
};

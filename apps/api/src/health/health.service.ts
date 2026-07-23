import { DEFAULT_TIME_ZONE } from "@agu/config";
import type { HealthResponse } from "@agu/contracts";
import { Injectable } from "@nestjs/common";

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: "ok",
      service: "agu-api",
      timeZone: DEFAULT_TIME_ZONE,
      checkedAt: new Date().toISOString()
    };
  }
}

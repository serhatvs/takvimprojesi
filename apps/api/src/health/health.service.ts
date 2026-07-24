import { DEFAULT_TIME_ZONE } from "@agu/config";
import type { HealthResponse, ReadyResponse } from "@agu/contracts";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth(): HealthResponse {
    return {
      status: "ok",
      service: "agu-api",
      timeZone: DEFAULT_TIME_ZONE,
      checkedAt: new Date().toISOString()
    };
  }

  async getReady(): Promise<ReadyResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        service: "agu-api",
        timeZone: DEFAULT_TIME_ZONE,
        checkedAt: new Date().toISOString()
      };
    } catch {
      return {
        status: "error",
        service: "agu-api",
        timeZone: DEFAULT_TIME_ZONE,
        checkedAt: new Date().toISOString(),
        error: "Database connection failed"
      };
    }
  }
}

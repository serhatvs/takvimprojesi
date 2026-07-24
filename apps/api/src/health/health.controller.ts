import { Controller, Get, Res } from "@nestjs/common";
import type { HealthResponse } from "@agu/contracts";
import { HealthService } from "./health.service";
import type { Response } from "express";

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get("health")
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }

  @Get("ready")
  async getReady(@Res() res: Response): Promise<void> {
    const result = await this.healthService.getReady();
    if (result.status === "error") {
      res.status(503).json(result);
    } else {
      res.status(200).json(result);
    }
  }
}

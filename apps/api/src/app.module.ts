import { Module } from "@nestjs/common";
import { EventLifecycleService } from "./events/event-lifecycle.service";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";

@Module({
  controllers: [HealthController],
  providers: [HealthService, EventLifecycleService]
})
export class AppModule {}

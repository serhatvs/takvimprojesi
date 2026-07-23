import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { EventLifecycleService } from "./events/event-lifecycle.service";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";

@Module({
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [HealthService, EventLifecycleService]
})
export class AppModule {}

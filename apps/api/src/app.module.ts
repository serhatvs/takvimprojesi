import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { EventLifecycleService } from "./events/event-lifecycle.service";
import { EventsModule } from "./events/events.module";
import { ClubsModule } from "./clubs/clubs.module";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";

@Module({
  imports: [AuthModule, EventsModule, ClubsModule],
  controllers: [HealthController],
  providers: [HealthService, EventLifecycleService]
})
export class AppModule {}

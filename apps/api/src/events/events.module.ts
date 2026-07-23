import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { EventsController } from "./events.controller";
import { EventLifecycleService } from "./event-lifecycle.service";
import { EventsService } from "./events.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [EventsController],
  providers: [EventLifecycleService, EventsService],
  exports: [EventsService]
})
export class EventsModule {}

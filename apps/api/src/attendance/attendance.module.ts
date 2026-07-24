import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AttendanceController } from "./attendance.controller";
import { AttendanceTokenService } from "./attendance-token.service";
import { AttendanceService } from "./attendance.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceTokenService],
  exports: [AttendanceService, AttendanceTokenService]
})
export class AttendanceModule {}

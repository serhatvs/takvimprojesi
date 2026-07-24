import { Body, Controller, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { AuthenticationGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { Principal } from "../auth/principal";
import { toAttendanceResponse, toAttendanceTokenResponse } from "../events/event-response";
import { AttendanceService } from "./attendance.service";

@Controller()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post("events/:eventId/attendance-token")
  @HttpCode(200)
  @UseGuards(AuthenticationGuard)
  async issueAttendanceToken(
    @CurrentUser() principal: Principal,
    @Param("eventId") eventId: string
  ) {
    const tokenData = await this.attendanceService.issueAttendanceToken(principal, eventId);
    return toAttendanceTokenResponse(tokenData);
  }

  @Post("attendance/check-in")
  @HttpCode(201)
  @UseGuards(AuthenticationGuard)
  async checkIn(
    @CurrentUser() principal: Principal,
    @Body() body: { token?: unknown }
  ) {
    const attendance = await this.attendanceService.checkIn(principal, body?.token);
    return toAttendanceResponse(attendance);
  }
}

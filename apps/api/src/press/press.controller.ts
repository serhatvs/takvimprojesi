import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthenticationGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { Principal } from "../auth/principal";
import type { PressEventsQueryDto } from "./dto/press-events-query.dto";
import { PressService } from "./press.service";

@Controller("press")
export class PressController {
  constructor(private readonly pressService: PressService) {}

  @Get("events")
  @UseGuards(AuthenticationGuard)
  async listSubmittedEvents(
    @CurrentUser() principal: Principal,
    @Query() query: PressEventsQueryDto
  ) {
    return this.pressService.listSubmittedEvents(principal, query);
  }

  @Get("events/approved")
  @UseGuards(AuthenticationGuard)
  async listApprovedEvents(
    @CurrentUser() principal: Principal,
    @Query() query: PressEventsQueryDto
  ) {
    return this.pressService.listApprovedEvents(principal, query);
  }
}

import { Body, Controller, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { AuthenticationGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { Principal } from "../auth/principal";
import type { CreateDraftEventDto } from "./dto/create-draft-event.dto";
import { toDraftEventResponse, toEventResponse } from "./event-response";
import { EventsService } from "./events.service";

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(AuthenticationGuard)
  async createDraftEvent(@CurrentUser() principal: Principal, @Body() body: CreateDraftEventDto) {
    const event = await this.eventsService.createDraftEvent(principal, body);
    return toDraftEventResponse(event);
  }

  @Post(":eventId/submit")
  @HttpCode(200)
  @UseGuards(AuthenticationGuard)
  async submitDraftEvent(@CurrentUser() principal: Principal, @Param("eventId") eventId: string) {
    const event = await this.eventsService.submitDraftEvent(principal, eventId);
    return toEventResponse(event);
  }
}

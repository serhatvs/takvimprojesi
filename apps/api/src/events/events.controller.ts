import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AuthenticationGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { Principal } from "../auth/principal";
import type { CreateDraftEventDto } from "./dto/create-draft-event.dto";
import { toDraftEventResponse } from "./event-response";
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
}

import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AuthenticationGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { Principal } from "../auth/principal";
import type { CreateDraftEventDto } from "./dto/create-draft-event.dto";
import type { PublicEventsQueryDto } from "./dto/public-events-query.dto";
import type { ReviewEventDto } from "./dto/review-event.dto";
import {
  toAttendanceResponse,
  toAttendanceTokenResponse,
  toDraftEventResponse,
  toEventAttendanceSummaryResponse,
  toEventResponse,
  toEventRegistrationResponse,
  toPublicEventDetailResponse,
  toPublicEventListItem
} from "./event-response";
import { EventsService } from "./events.service";

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async listPublicEvents(@Query() query: PublicEventsQueryDto) {
    const result = await this.eventsService.listPublicEvents(query);
    return {
      items: result.items.map(toPublicEventListItem),
      pagination: result.pagination
    };
  }

  @Get(":eventId")
  async getPublicEvent(@Param("eventId") eventId: string) {
    const event = await this.eventsService.getPublicEvent(eventId);
    return toPublicEventDetailResponse(event);
  }

  @Get(":eventId/registration")
  @UseGuards(AuthenticationGuard)
  async getRegistrationStatus(
    @CurrentUser() principal: Principal,
    @Param("eventId") eventId: string
  ) {
    const registration = await this.eventsService.getEventRegistrationStatus(principal, eventId);
    return {
      registered: registration !== null,
      registration: registration ? toEventRegistrationResponse(registration) : null
    };
  }

  @Get(":eventId/attendance-summary")
  @UseGuards(AuthenticationGuard)
  async getAttendanceSummary(
    @CurrentUser() principal: Principal,
    @Param("eventId") eventId: string
  ) {
    const summary = await this.eventsService.getAttendanceSummary(principal, eventId);
    return toEventAttendanceSummaryResponse(summary);
  }

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

  @Post(":eventId/request-changes")
  @HttpCode(200)
  @UseGuards(AuthenticationGuard)
  async requestChanges(
    @CurrentUser() principal: Principal,
    @Param("eventId") eventId: string,
    @Body() body: ReviewEventDto
  ) {
    const event = await this.eventsService.reviewEvent(
      principal,
      eventId,
      "CHANGES_REQUESTED",
      body?.comment
    );
    return toEventResponse(event);
  }

  @Post(":eventId/reject")
  @HttpCode(200)
  @UseGuards(AuthenticationGuard)
  async rejectEvent(
    @CurrentUser() principal: Principal,
    @Param("eventId") eventId: string,
    @Body() body: ReviewEventDto
  ) {
    const event = await this.eventsService.reviewEvent(
      principal,
      eventId,
      "REJECTED",
      body?.comment
    );
    return toEventResponse(event);
  }

  @Post(":eventId/approve")
  @HttpCode(200)
  @UseGuards(AuthenticationGuard)
  async approveEvent(
    @CurrentUser() principal: Principal,
    @Param("eventId") eventId: string,
    @Body() body: ReviewEventDto
  ) {
    const event = await this.eventsService.reviewEvent(
      principal,
      eventId,
      "APPROVED",
      body?.comment
    );
    return toEventResponse(event);
  }

  @Post(":eventId/publish")
  @HttpCode(200)
  @UseGuards(AuthenticationGuard)
  async publishEvent(@CurrentUser() principal: Principal, @Param("eventId") eventId: string) {
    const event = await this.eventsService.publishEvent(principal, eventId);
    return toEventResponse(event);
  }

  @Post(":eventId/register")
  @UseGuards(AuthenticationGuard)
  async registerForEvent(@CurrentUser() principal: Principal, @Param("eventId") eventId: string) {
    const registration = await this.eventsService.registerForEvent(principal, eventId);
    return toEventRegistrationResponse(registration);
  }

  @Post(":eventId/attendance-token")
  @HttpCode(200)
  @UseGuards(AuthenticationGuard)
  async issueAttendanceToken(
    @CurrentUser() principal: Principal,
    @Param("eventId") eventId: string
  ) {
    const token = await this.eventsService.issueAttendanceToken(principal, eventId);
    return toAttendanceTokenResponse(token);
  }

  @Post(":eventId/check-in")
  @UseGuards(AuthenticationGuard)
  async checkIn(
    @CurrentUser() principal: Principal,
    @Param("eventId") eventId: string,
    @Body() body: { token?: unknown }
  ) {
    const attendance = await this.eventsService.checkInWithAttendanceToken(
      principal,
      eventId,
      body?.token
    );
    return toAttendanceResponse(attendance);
  }
}

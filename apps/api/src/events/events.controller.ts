import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthenticationGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { Principal } from "../auth/principal";
import type { CancelEventDto } from "./dto/cancel-event.dto";
import type { CreateDraftEventDto } from "./dto/create-draft-event.dto";
import type { PublicEventsQueryDto } from "./dto/public-events-query.dto";
import type { ReviewEventDto } from "./dto/review-event.dto";
import type { UpdateEventRevisionDto } from "./dto/update-event-revision.dto";
import {
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

  @Get(":eventId/revision")
  @UseGuards(AuthenticationGuard)
  async getEventRevision(
    @CurrentUser() principal: Principal,
    @Param("eventId") eventId: string
  ) {
    return this.eventsService.getEventRevision(principal, eventId);
  }

  @Patch(":eventId/revision")
  @UseGuards(AuthenticationGuard)
  async updateEventRevision(
    @CurrentUser() principal: Principal,
    @Param("eventId") eventId: string,
    @Body() body: UpdateEventRevisionDto
  ) {
    const event = await this.eventsService.updateEventRevision(principal, eventId, body);
    return toEventResponse(event);
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

  @Post(":eventId/cancel")
  @HttpCode(200)
  @UseGuards(AuthenticationGuard)
  async cancelEvent(
    @CurrentUser() principal: Principal,
    @Param("eventId") eventId: string,
    @Body() body: CancelEventDto
  ) {
    const event = await this.eventsService.cancelEvent(principal, eventId, body);
    return toEventResponse(event);
  }

  @Post(":eventId/complete")
  @HttpCode(200)
  @UseGuards(AuthenticationGuard)
  async completeEvent(@CurrentUser() principal: Principal, @Param("eventId") eventId: string) {
    const event = await this.eventsService.completeEvent(principal, eventId);
    return toEventResponse(event);
  }

  @Post(":eventId/register")
  @UseGuards(AuthenticationGuard)
  async registerForEvent(@CurrentUser() principal: Principal, @Param("eventId") eventId: string) {
    const registration = await this.eventsService.registerForEvent(principal, eventId);
    return toEventRegistrationResponse(registration);
  }
}

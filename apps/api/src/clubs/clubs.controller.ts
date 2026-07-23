import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AuthenticationGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { Principal } from "../auth/principal";
import { ClubsService } from "./clubs.service";
import type { ClubEventsQueryDto } from "./dto/club-events-query.dto";
import type { ClubEventListItem } from "@agu/contracts";
import type { Event } from "@prisma/client";

function toClubEventListItem(event: Event): ClubEventListItem {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    location: event.location,
    capacity: event.capacity,
    status: event.status,
    publishedAt: event.publishedAt?.toISOString() ?? null,
    updatedAt: event.updatedAt.toISOString()
  };
}

@Controller("clubs")
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Get("manageable")
  @UseGuards(AuthenticationGuard)
  async getManageableClubs(@CurrentUser() principal: Principal) {
    const clubs = await this.clubsService.getManageableClubs(principal);
    return { clubs };
  }

  @Get(":clubId/events")
  @UseGuards(AuthenticationGuard)
  async getClubEvents(
    @CurrentUser() principal: Principal,
    @Param("clubId") clubId: string,
    @Query() query: ClubEventsQueryDto
  ) {
    const response = await this.clubsService.getClubEvents(principal, clubId, query);
    
    return {
      club: response.club,
      items: response.items.map(toClubEventListItem),
      pagination: response.pagination,
      statusCounts: response.statusCounts
    };
  }
}

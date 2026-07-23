import { Injectable } from "@nestjs/common";
import type { ClubMembershipRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { Principal } from "./principal";

const EVENT_CREATOR_CLUB_ROLES: ClubMembershipRole[] = ["ADMIN"];
const EVENT_SUBMITTER_CLUB_ROLES: ClubMembershipRole[] = ["ADMIN"];

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveClubMembership(userId: string, clubId: string) {
    return this.prisma.clubMembership.findFirst({
      where: {
        userId,
        clubId,
        isActive: true,
        club: { isActive: true }
      },
      include: { club: true }
    });
  }

  async hasActiveClubRole(
    userId: string,
    clubId: string,
    allowedRoles: ClubMembershipRole[]
  ): Promise<boolean> {
    const membership = await this.getActiveClubMembership(userId, clubId);
    return membership ? allowedRoles.includes(membership.role) : false;
  }

  async canCreateEventForClub(principal: Principal, clubId: string): Promise<boolean> {
    if (principal.globalRoles.includes("SYSTEM_ADMIN")) {
      return true;
    }

    return this.hasActiveClubRole(principal.userId, clubId, EVENT_CREATOR_CLUB_ROLES);
  }

  async canSubmitEventForClub(principal: Principal, clubId: string): Promise<boolean> {
    if (principal.globalRoles.includes("SYSTEM_ADMIN")) {
      return true;
    }

    return this.hasActiveClubRole(principal.userId, clubId, EVENT_SUBMITTER_CLUB_ROLES);
  }
}

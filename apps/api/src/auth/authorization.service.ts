import { Injectable } from "@nestjs/common";
import type { ClubMembershipRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

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
}

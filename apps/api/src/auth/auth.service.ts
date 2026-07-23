import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { Principal } from "./principal";

type PrincipalUser = Prisma.UserGetPayload<{
  include: {
    roles: true;
    memberships: {
      include: {
        club: true;
      };
    };
  };
}>;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  isDevAuthAvailable(): boolean {
    return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_AUTH === "true";
  }

  ensureDevAuthAvailable(): void {
    if (!this.isDevAuthAvailable()) {
      throw new ForbiddenException("Development authentication is disabled.");
    }
  }

  async findPrincipalByEmail(email: string): Promise<Principal> {
    this.ensureDevAuthAvailable();

    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      include: this.principalInclude()
    });

    if (!user) {
      throw new NotFoundException("User was not found.");
    }

    return this.toPrincipal(user);
  }

  async resolvePrincipal(userId: string): Promise<Principal | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      include: this.principalInclude()
    });

    return user ? this.toPrincipal(user) : null;
  }

  private principalInclude() {
    return {
      roles: true,
      memberships: {
        where: { isActive: true },
        include: {
          club: true
        }
      }
    } as const;
  }

  private toPrincipal(user: PrincipalUser): Principal {
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      globalRoles: user.roles.map((role) => role.role),
      clubMemberships: user.memberships.map((membership) => ({
        clubId: membership.club.id,
        clubSlug: membership.club.slug,
        clubName: membership.club.name,
        role: membership.role
      }))
    };
  }
}

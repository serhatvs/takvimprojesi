import type { ClubMembershipRole, RoleName } from "@prisma/client";

export type PrincipalClubMembership = {
  clubId: string;
  clubSlug: string;
  clubName: string;
  role: ClubMembershipRole;
};

export type Principal = {
  userId: string;
  email: string;
  displayName: string;
  globalRoles: RoleName[];
  clubMemberships: PrincipalClubMembership[];
};

export type RequestWithPrincipal = {
  user?: Principal;
  cookies?: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
};

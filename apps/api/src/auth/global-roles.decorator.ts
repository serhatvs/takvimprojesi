import { SetMetadata } from "@nestjs/common";
import type { RoleName } from "@prisma/client";
import { GLOBAL_ROLES_KEY } from "./auth.constants";

export const RequireGlobalRoles = (...roles: RoleName[]) => SetMetadata(GLOBAL_ROLES_KEY, roles);

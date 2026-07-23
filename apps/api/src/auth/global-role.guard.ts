import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RoleName } from "@prisma/client";
import { GLOBAL_ROLES_KEY } from "./auth.constants";
import type { RequestWithPrincipal } from "./principal";

@Injectable()
export class GlobalRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<RoleName[]>(GLOBAL_ROLES_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const principal = request.user;

    if (!principal) {
      throw new ForbiddenException("Role check requires an authenticated principal.");
    }

    const allowed = requiredRoles.some((role) => principal.globalRoles.includes(role));

    if (!allowed) {
      throw new ForbiddenException("Insufficient role.");
    }

    return true;
  }
}

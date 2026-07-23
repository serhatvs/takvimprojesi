import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AUTH_SESSION_COOKIE_NAME } from "./auth.constants";
import { AuthService } from "./auth.service";
import { AuthSessionService } from "./auth-session.service";
import type { RequestWithPrincipal } from "./principal";

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: AuthSessionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const token = this.readSessionCookie(request);

    if (!token) {
      throw new UnauthorizedException("Authentication is required.");
    }

    const payload = await this.sessionService.verifySessionToken(token);
    const principal = await this.authService.resolvePrincipal(payload.sub);

    if (!principal) {
      throw new UnauthorizedException("Authentication is required.");
    }

    request.user = principal;
    return true;
  }

  private readSessionCookie(request: RequestWithPrincipal): string | undefined {
    const parsedCookie = request.cookies?.[AUTH_SESSION_COOKIE_NAME];
    if (parsedCookie) {
      return parsedCookie;
    }

    const cookieHeader = request.headers.cookie;
    if (!cookieHeader || Array.isArray(cookieHeader)) {
      return undefined;
    }

    return cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${AUTH_SESSION_COOKIE_NAME}=`))
      ?.slice(AUTH_SESSION_COOKIE_NAME.length + 1);
  }
}

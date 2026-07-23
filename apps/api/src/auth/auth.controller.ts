import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthenticationGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AuthSessionService } from "./auth-session.service";
import { CurrentUser } from "./current-user.decorator";
import type { Principal } from "./principal";

type DevLoginBody = {
  email?: unknown;
};

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: AuthSessionService
  ) {}

  @Post("dev-login")
  async devLogin(@Body() body: DevLoginBody, @Res({ passthrough: true }) response: Response) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const principal = await this.authService.findPrincipalByEmail(email);
    const token = await this.sessionService.createSessionToken(principal.userId);

    this.sessionService.setSessionCookie(response, token);

    return { user: principal };
  }

  @Get("me")
  @UseGuards(AuthenticationGuard)
  me(@CurrentUser() principal: Principal) {
    return { user: principal };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    this.sessionService.clearSessionCookie(response);
    return { ok: true };
  }
}

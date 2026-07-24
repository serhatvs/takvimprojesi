import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthenticationGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AuthSessionService } from "./auth-session.service";
import { CurrentUser } from "./current-user.decorator";
import type { Principal } from "./principal";
import { EmailOtpService } from "./email/email-otp.service";

type DevLoginBody = {
  email?: unknown;
};

type RequestCodeBody = {
  email?: unknown;
};

type VerifyCodeBody = {
  email?: unknown;
  code?: unknown;
  displayName?: unknown;
};

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: AuthSessionService,
    private readonly emailOtpService: EmailOtpService
  ) {}

  @Post("dev-login")
  async devLogin(@Body() body: DevLoginBody, @Res({ passthrough: true }) response: Response) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const principal = await this.authService.findPrincipalByEmail(email);
    const token = await this.sessionService.createSessionToken(principal.userId);

    this.sessionService.setSessionCookie(response, token);

    return { user: principal };
  }

  @Post("email/request-code")
  @HttpCode(202)
  async requestCode(@Body() body: RequestCodeBody) {
    return this.emailOtpService.requestCode(body?.email);
  }

  @Post("email/verify-code")
  async verifyCode(
    @Body() body: VerifyCodeBody,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.emailOtpService.verifyCode(
      body?.email,
      body?.code,
      body?.displayName
    );

    this.sessionService.setSessionCookie(response, result.token);

    return { user: result.user };
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

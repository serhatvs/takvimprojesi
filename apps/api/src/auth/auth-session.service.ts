import { Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Response } from "express";
import { AUTH_SESSION_COOKIE_NAME, AUTH_SESSION_TTL_SECONDS } from "./auth.constants";

type SessionPayload = {
  sub: string;
};

@Injectable()
export class AuthSessionService {
  constructor(private readonly jwtService: JwtService) {}

  async createSessionToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId } satisfies SessionPayload,
      {
        secret: this.getSessionSecret(),
        expiresIn: AUTH_SESSION_TTL_SECONDS
      }
    );
  }

  async verifySessionToken(token: string): Promise<SessionPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<SessionPayload>(token, {
        secret: this.getSessionSecret()
      });

      if (!payload.sub) {
        throw new UnauthorizedException("Invalid session.");
      }

      return { sub: payload.sub };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Invalid session.");
    }
  }

  setSessionCookie(response: Response, token: string): void {
    response.cookie(AUTH_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: AUTH_SESSION_TTL_SECONDS * 1000
    });
  }

  clearSessionCookie(response: Response): void {
    response.clearCookie(AUTH_SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
  }

  private getSessionSecret(): string {
    const secret = process.env.AUTH_SESSION_SECRET;

    if (!secret) {
      throw new InternalServerErrorException("Session secret is not configured.");
    }

    return secret;
  }
}

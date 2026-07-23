import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { AuthSessionService } from "./auth-session.service";

const originalEnv = { ...process.env };

describe("AuthSessionService", () => {
  let service: AuthSessionService;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AUTH_SESSION_SECRET: "unit-test-session-secret"
    };
    service = new AuthSessionService(new JwtService());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates and verifies a session token with a user id payload", async () => {
    const token = await service.createSessionToken("user-1");
    const payload = await service.verifySessionToken(token);

    expect(payload).toEqual({ sub: "user-1" });
    expect(token).not.toContain("STUDENT");
  });

  it("rejects an invalid token", async () => {
    await expect(service.verifySessionToken("not-a-token")).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("rejects an expired token", async () => {
    const expiredToken = await new JwtService().signAsync(
      { sub: "user-1" },
      {
        secret: "unit-test-session-secret",
        expiresIn: -1
      }
    );

    await expect(service.verifySessionToken(expiredToken)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});

import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AUTH_SESSION_COOKIE_NAME } from "../src/auth/auth.constants";
import { computeOtpHash } from "../src/auth/email/email-otp.service";
import { PrismaService } from "../src/prisma/prisma.service";

const originalEnv = { ...process.env };

function getSessionCookie(setCookie: string | string[] | undefined): string {
  const values = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = values.find((value) => value.startsWith(`${AUTH_SESSION_COOKIE_NAME}=`));
  if (!cookie) {
    throw new Error("Session cookie was not set.");
  }

  const [sessionCookie] = cookie.split(";");
  if (!sessionCookie) {
    throw new Error("Session cookie was empty.");
  }

  return sessionCookie;
}

describe("Auth endpoints", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      ENABLE_DEV_AUTH: "true",
      AUTH_SESSION_SECRET: "integration-test-session-secret"
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.ENABLE_DEV_AUTH = "true";
    process.env.AUTH_SESSION_SECRET = "integration-test-session-secret";
  });

  afterAll(async () => {
    await app.close();
    process.env = { ...originalEnv };
  });

  it("logs in with a valid seed user and sets an HttpOnly session cookie", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "student.dev@agu.edu.tr" })
      .expect(201);

    expect(response.body.user).toMatchObject({
      email: "student.dev@agu.edu.tr",
      displayName: "Dev Student",
      globalRoles: ["STUDENT"]
    });
    expect(JSON.stringify(response.body)).not.toContain("integration-test-session-secret");
    expect(JSON.stringify(response.body)).not.toContain(AUTH_SESSION_COOKIE_NAME);
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
  });

  it("returns 404 for an unknown development user", async () => {
    await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "missing@example.local" })
      .expect(404);
  });

  it("returns the current principal when a valid cookie is sent", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "club.admin.dev@agu.edu.tr" })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", getSessionCookie(login.headers["set-cookie"]))
      .expect(200);

    expect(response.body.user).toMatchObject({
      email: "club.admin.dev@agu.edu.tr",
      globalRoles: ["STUDENT", "CLUB_MEMBER", "CLUB_ADMIN"]
    });
    expect(response.body.user.clubMemberships).toEqual([
      expect.objectContaining({
        clubSlug: "agu-yazilim-kulubu",
        role: "ADMIN"
      })
    ]);
  });

  it("returns 401 when /auth/me is called without a cookie", async () => {
    await request(app.getHttpServer()).get("/auth/me").expect(401);
  });

  it("clears the cookie on logout and rejects the cleared cookie", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "student.dev@agu.edu.tr" })
      .expect(201);

    const logout = await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", getSessionCookie(login.headers["set-cookie"]))
      .expect(201);

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", getSessionCookie(logout.headers["set-cookie"]))
      .expect(401);
  });

  it("blocks login when development auth is disabled", async () => {
    process.env.ENABLE_DEV_AUTH = "false";

    await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "student.dev@agu.edu.tr" })
      .expect(403);
  });

  it("ignores roles forged into a validly signed session token", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "student.dev@agu.edu.tr" })
      .expect(201);

    const forgedToken = await new JwtService().signAsync(
      {
        sub: login.body.user.userId,
        globalRoles: ["SYSTEM_ADMIN"]
      },
      {
        secret: "integration-test-session-secret",
        expiresIn: "1h"
      }
    );

    const response = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `${AUTH_SESSION_COOKIE_NAME}=${forgedToken}`)
      .expect(200);

    expect(response.body.user.globalRoles).toEqual(["STUDENT"]);
  });

  it("returns 401 for a tampered token without leaking the token or secret", async () => {
    const response = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `${AUTH_SESSION_COOKIE_NAME}=tampered-token`)
      .expect(401);

    expect(JSON.stringify(response.body)).not.toContain("tampered-token");
    expect(JSON.stringify(response.body)).not.toContain("integration-test-session-secret");
  });

  describe("POST /auth/email/request-code and POST /auth/email/verify-code", () => {
    it("returns 202 Accepted for request-code without leaking account existence", async () => {
      const res1 = await request(app.getHttpServer())
        .post("/auth/email/request-code")
        .send({ email: "student.dev@agu.edu.tr" })
        .expect(202);

      expect(res1.body).toEqual({
        message: "Kod gönderilebildiyse e-posta adresinize ulaştırıldı."
      });

      const res2 = await request(app.getHttpServer())
        .post("/auth/email/request-code")
        .send({ email: "brandnew.user@gmail.com" })
        .expect(202);

      expect(res2.body).toEqual({
        message: "Kod gönderilebildiyse e-posta adresinize ulaştırıldı."
      });
    });

    it("returns 400 for invalid email format on request-code", async () => {
      await request(app.getHttpServer())
        .post("/auth/email/request-code")
        .send({ email: "invalid-email-format" })
        .expect(400);
    });

    it("verifies OTP and sets session cookie for AGÜ student", async () => {
      const email = "test.student.otp@agu.edu.tr";
      const code = "123456";
      const hash = computeOtpHash(email, code);

      const prisma = app.get(PrismaService);
      await prisma.emailLoginChallenge.create({
        data: {
          email,
          otpHash: hash,
          expiresAt: new Date(Date.now() + 600000)
        }
      });

      // Wrong code returns 400
      await request(app.getHttpServer())
        .post("/auth/email/verify-code")
        .send({ email, code: "000000", displayName: "Test OTP Student" })
        .expect(400);

      // Correct code returns 201/200, creates user with STUDENT role and sets session cookie
      const verifyRes = await request(app.getHttpServer())
        .post("/auth/email/verify-code")
        .send({ email, code, displayName: "Test OTP Student" })
        .expect(201);

      expect(verifyRes.body.user).toMatchObject({
        email,
        displayName: "Test OTP Student",
        roles: ["STUDENT"]
      });

      const cookie = getSessionCookie(verifyRes.headers["set-cookie"]);

      // Verify /auth/me with session cookie
      const meRes = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Cookie", cookie)
        .expect(200);

      expect(meRes.body.user).toMatchObject({
        email,
        displayName: "Test OTP Student",
        globalRoles: ["STUDENT"]
      });

      // Reusing consumed code fails with 400
      await request(app.getHttpServer())
        .post("/auth/email/verify-code")
        .send({ email, code, displayName: "Test OTP Student" })
        .expect(400);
    });

    it("verifies OTP and sets session cookie for external participant", async () => {
      const email = "external.visitor@gmail.com";
      const code = "654321";
      const hash = computeOtpHash(email, code);

      const prisma = app.get(PrismaService);
      await prisma.emailLoginChallenge.create({
        data: {
          email,
          otpHash: hash,
          expiresAt: new Date(Date.now() + 600000)
        }
      });

      const verifyRes = await request(app.getHttpServer())
        .post("/auth/email/verify-code")
        .send({ email, code, displayName: "External Visitor" })
        .expect(201);

      expect(verifyRes.body.user).toMatchObject({
        email,
        displayName: "External Visitor",
        roles: ["EXTERNAL_PARTICIPANT"]
      });
    });

    it("returns 503 when email auth is disabled", async () => {
      process.env.ENABLE_EMAIL_AUTH = "false";

      await request(app.getHttpServer())
        .post("/auth/email/request-code")
        .send({ email: "user@agu.edu.tr" })
        .expect(503);

      await request(app.getHttpServer())
        .post("/auth/email/verify-code")
        .send({ email: "user@agu.edu.tr", code: "123456" })
        .expect(503);
    });
  });
});

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AUTH_SESSION_COOKIE_NAME } from "../src/auth/auth.constants";
import { loadRootEnv } from "../src/config/load-env";

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

describe("POST /events", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let clubId: string;
  let otherClubId: string;
  let clubAdminCookie: string;
  let studentCookie: string;

  beforeAll(async () => {
    loadRootEnv();
    process.env = {
      ...originalEnv,
      DATABASE_URL: process.env.DATABASE_URL,
      NODE_ENV: "test",
      ENABLE_DEV_AUTH: "true",
      AUTH_SESSION_SECRET: "integration-test-session-secret"
    };

    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests.");
    }

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const seedClub = await prisma.club.findUniqueOrThrow({
      where: { slug: "agu-yazilim-kulubu" }
    });
    clubId = seedClub.id;

    const otherClub = await prisma.club.upsert({
      where: { slug: "events-integration-other-club" },
      update: { isActive: true },
      create: {
        name: "Events Integration Other Club",
        slug: "events-integration-other-club",
        description: "Integration test club."
      }
    });
    otherClubId = otherClub.id;

    const clubAdminLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "club.admin.dev@agu.edu.tr" })
      .expect(201);
    clubAdminCookie = getSessionCookie(clubAdminLogin.headers["set-cookie"]);

    const studentLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "student.dev@agu.edu.tr" })
      .expect(201);
    studentCookie = getSessionCookie(studentLogin.headers["set-cookie"]);
  });

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.ENABLE_DEV_AUTH = "true";
    process.env.AUTH_SESSION_SECRET = "integration-test-session-secret";
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.event.deleteMany({
        where: {
          slug: {
            startsWith: "integration-draft-event"
          }
        }
      });
      await prisma.club.deleteMany({
        where: { slug: "events-integration-other-club" }
      });
      await prisma.$disconnect();
    }
    await app?.close();
    process.env = { ...originalEnv };
  });

  it("returns 401 without authentication", async () => {
    await request(app.getHttpServer()).post("/events").send(validBody(clubId)).expect(401);
  });

  it("creates a draft event for an authorized seed club admin", async () => {
    const response = await request(app.getHttpServer())
      .post("/events")
      .set("Cookie", clubAdminCookie)
      .send({
        ...validBody(clubId),
        createdById: "forged-user-id",
        status: "PUBLISHED"
      })
      .expect(201);

    expect(response.body).toMatchObject({
      clubId,
      title: expect.stringContaining("Integration Draft Event"),
      description: "Integration draft event description",
      location: "AGU Buyuk Amfi",
      capacity: 100,
      status: "DRAFT"
    });
    expect(response.body.startsAt).toBe("2026-08-10T11:00:00.000Z");
    expect(response.body.endsAt).toBe("2026-08-10T13:00:00.000Z");

    const event = await prisma.event.findUniqueOrThrow({
      where: { id: response.body.id }
    });
    const clubAdmin = await prisma.user.findUniqueOrThrow({
      where: { email: "club.admin.dev@agu.edu.tr" }
    });

    expect(event.createdById).toBe(clubAdmin.id);
    expect(event.status).toBe("DRAFT");
  });

  it("returns 403 when creating for another club", async () => {
    await request(app.getHttpServer())
      .post("/events")
      .set("Cookie", clubAdminCookie)
      .send(validBody(otherClubId))
      .expect(403);
  });

  it("returns 403 for an authenticated user without an active authorized club role", async () => {
    await request(app.getHttpServer())
      .post("/events")
      .set("Cookie", studentCookie)
      .send(validBody(clubId))
      .expect(403);
  });

  it("returns 404 for an unknown club", async () => {
    await request(app.getHttpServer())
      .post("/events")
      .set("Cookie", clubAdminCookie)
      .send(validBody("00000000-0000-0000-0000-000000000000"))
      .expect(404);
  });

  it("returns 400 for invalid dates and capacity", async () => {
    await request(app.getHttpServer())
      .post("/events")
      .set("Cookie", clubAdminCookie)
      .send({
        ...validBody(clubId),
        startsAt: "2026-08-10T16:00:00+03:00",
        capacity: 0
      })
      .expect(400);
  });
});

function validBody(clubId: string) {
  return {
    clubId,
    title: `Integration Draft Event ${Date.now()}`,
    description: "Integration draft event description",
    startsAt: "2026-08-10T14:00:00+03:00",
    endsAt: "2026-08-10T16:00:00+03:00",
    location: "AGU Buyuk Amfi",
    capacity: 100
  };
}

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleName } from "@prisma/client";
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
  let clubMemberCookie: string;
  let pressCookie: string;
  let otherClubAdminCookie: string;
  let clubAdminId: string;

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

    const clubAdmin = await prisma.user.findUniqueOrThrow({
      where: { email: "club.admin.dev@agu.edu.tr" }
    });
    clubAdminId = clubAdmin.id;

    const otherClubAdmin = await prisma.user.upsert({
      where: { email: "events.other.admin.dev@agu.edu.tr" },
      update: {
        displayName: "Events Other Club Admin",
        isActive: true,
        roles: {
          deleteMany: {},
          create: [{ role: RoleName.STUDENT }, { role: RoleName.CLUB_MEMBER }, { role: RoleName.CLUB_ADMIN }]
        }
      },
      create: {
        email: "events.other.admin.dev@agu.edu.tr",
        displayName: "Events Other Club Admin",
        roles: {
          create: [{ role: RoleName.STUDENT }, { role: RoleName.CLUB_MEMBER }, { role: RoleName.CLUB_ADMIN }]
        }
      }
    });

    await prisma.clubMembership.upsert({
      where: {
        userId_clubId: {
          userId: otherClubAdmin.id,
          clubId: otherClubId
        }
      },
      update: { role: "ADMIN", isActive: true },
      create: {
        userId: otherClubAdmin.id,
        clubId: otherClubId,
        role: "ADMIN"
      }
    });

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

    const clubMemberLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "club.member.dev@agu.edu.tr" })
      .expect(201);
    clubMemberCookie = getSessionCookie(clubMemberLogin.headers["set-cookie"]);

    const pressLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "press.dev@agu.edu.tr" })
      .expect(201);
    pressCookie = getSessionCookie(pressLogin.headers["set-cookie"]);

    const otherClubAdminLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "events.other.admin.dev@agu.edu.tr" })
      .expect(201);
    otherClubAdminCookie = getSessionCookie(otherClubAdminLogin.headers["set-cookie"]);
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
      await prisma.auditLog.deleteMany({
        where: {
          entityType: "Event",
          entityId: {
            startsWith: "integration-submit-event"
          }
        }
      });
      const submitEvents = await prisma.event.findMany({
        where: {
          slug: {
            startsWith: "integration-submit-event"
          }
        },
        select: { id: true }
      });
      if (submitEvents.length > 0) {
        await prisma.auditLog.deleteMany({
          where: {
            entityType: "Event",
            entityId: {
              in: submitEvents.map((event) => event.id)
            }
          }
        });
        await prisma.event.deleteMany({
          where: {
            id: {
              in: submitEvents.map((event) => event.id)
            }
          }
        });
      }
      await prisma.clubMembership.deleteMany({
        where: {
          user: { email: "events.other.admin.dev@agu.edu.tr" }
        }
      });
      await prisma.userRole.deleteMany({
        where: {
          user: { email: "events.other.admin.dev@agu.edu.tr" }
        }
      });
      await prisma.user.deleteMany({
        where: { email: "events.other.admin.dev@agu.edu.tr" }
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

  it("returns 401 when submitting without authentication", async () => {
    const event = await createDraftEvent("integration-submit-event-unauth");

    await request(app.getHttpServer()).post(`/events/${event.id}/submit`).expect(401);
  });

  it("submits a draft event for an authorized seed club admin and writes audit", async () => {
    const event = await createDraftEvent("integration-submit-event-success");

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/submit`)
      .set("Cookie", clubAdminCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      id: event.id,
      clubId,
      createdById: clubAdminId,
      status: "SUBMITTED"
    });

    const storedEvent = await prisma.event.findUniqueOrThrow({
      where: { id: event.id }
    });
    expect(storedEvent.status).toBe("SUBMITTED");
    expect(storedEvent.createdById).toBe(clubAdminId);

    const audits = await prisma.auditLog.findMany({
      where: {
        entityType: "Event",
        entityId: event.id,
        action: "EVENT_SUBMITTED"
      }
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: clubAdminId,
      before: { status: "DRAFT" },
      after: { status: "SUBMITTED" }
    });
  });

  it("returns 403 for another club admin", async () => {
    const event = await createDraftEvent("integration-submit-event-other-admin");

    await request(app.getHttpServer())
      .post(`/events/${event.id}/submit`)
      .set("Cookie", otherClubAdminCookie)
      .expect(403);
  });

  it("returns 403 for a normal student, club member, and press editor", async () => {
    const studentEvent = await createDraftEvent("integration-submit-event-student");
    const memberEvent = await createDraftEvent("integration-submit-event-member");
    const pressEvent = await createDraftEvent("integration-submit-event-press");

    await request(app.getHttpServer())
      .post(`/events/${studentEvent.id}/submit`)
      .set("Cookie", studentCookie)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/events/${memberEvent.id}/submit`)
      .set("Cookie", clubMemberCookie)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/events/${pressEvent.id}/submit`)
      .set("Cookie", pressCookie)
      .expect(403);
  });

  it("returns 404 for an unknown event", async () => {
    await request(app.getHttpServer())
      .post("/events/00000000-0000-4000-8000-000000000000/submit")
      .set("Cookie", clubAdminCookie)
      .expect(404);
  });

  it("returns 400 for an invalid event id", async () => {
    await request(app.getHttpServer())
      .post("/events/not-a-valid-id/submit")
      .set("Cookie", clubAdminCookie)
      .expect(400);
  });

  it("returns 409 for an already submitted event", async () => {
    const event = await createDraftEvent("integration-submit-event-already-submitted");
    await prisma.event.update({
      where: { id: event.id },
      data: { status: "SUBMITTED" }
    });

    await request(app.getHttpServer())
      .post(`/events/${event.id}/submit`)
      .set("Cookie", clubAdminCookie)
      .expect(409);
  });

  it("allows only the first repeated submit and writes one audit record", async () => {
    const event = await createDraftEvent("integration-submit-event-repeat");

    await request(app.getHttpServer())
      .post(`/events/${event.id}/submit`)
      .set("Cookie", clubAdminCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/events/${event.id}/submit`)
      .set("Cookie", clubAdminCookie)
      .expect(409);

    const audits = await prisma.auditLog.findMany({
      where: {
        entityType: "Event",
        entityId: event.id,
        action: "EVENT_SUBMITTED"
      }
    });
    expect(audits).toHaveLength(1);
  });

  it("does not create audit for failed submit", async () => {
    const event = await createDraftEvent("integration-submit-event-failed-audit");

    await request(app.getHttpServer())
      .post(`/events/${event.id}/submit`)
      .set("Cookie", studentCookie)
      .expect(403);

    const auditCount = await prisma.auditLog.count({
      where: {
        entityType: "Event",
        entityId: event.id,
        action: "EVENT_SUBMITTED"
      }
    });
    expect(auditCount).toBe(0);
  });

  async function createDraftEvent(slugPrefix: string) {
    return prisma.event.create({
      data: {
        clubId,
        createdById: clubAdminId,
        title: `Submit Integration Event ${Date.now()}`,
        slug: `${slugPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        description: "Submit integration event description",
        startsAt: new Date("2026-08-10T11:00:00.000Z"),
        endsAt: new Date("2026-08-10T13:00:00.000Z"),
        location: "AGU Buyuk Amfi",
        capacity: 100,
        status: "DRAFT"
      }
    });
  }
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

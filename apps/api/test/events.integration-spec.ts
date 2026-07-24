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
  let systemAdminCookie: string;
  let otherClubAdminCookie: string;
  let clubAdminId: string;
  let studentId: string;
  let clubMemberId: string;
  let pressEditorId: string;

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
    const studentUser = await prisma.user.findUniqueOrThrow({
      where: { email: "student.dev@agu.edu.tr" }
    });
    studentId = studentUser.id;

    const clubMemberLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "club.member.dev@agu.edu.tr" })
      .expect(201);
    clubMemberCookie = getSessionCookie(clubMemberLogin.headers["set-cookie"]);
    const clubMember = await prisma.user.findUniqueOrThrow({
      where: { email: "club.member.dev@agu.edu.tr" }
    });
    clubMemberId = clubMember.id;

    const pressLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "press.dev@agu.edu.tr" })
      .expect(201);
    pressCookie = getSessionCookie(pressLogin.headers["set-cookie"]);
    const pressEditor = await prisma.user.findUniqueOrThrow({
      where: { email: "press.dev@agu.edu.tr" }
    });
    pressEditorId = pressEditor.id;

    const systemAdminLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "admin.dev@agu.edu.tr" })
      .expect(201);
    systemAdminCookie = getSessionCookie(systemAdminLogin.headers["set-cookie"]);

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
          OR: [
            { slug: { startsWith: "integration-submit-event" } },
            { slug: { startsWith: "integration-review-event" } },
            { slug: { startsWith: "integration-publish-event" } },
            { slug: { startsWith: "integration-public-event" } },
            { slug: { startsWith: "integration-registration-event" } },
            { slug: { startsWith: "integration-summary-event" } }
          ]
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

  it("lists public events without authentication", async () => {
    await createPublicEvent("integration-public-event-unauth", {
      title: "Public Unaith Listed Event",
      status: "PUBLISHED"
    });

    await request(app.getHttpServer())
      .get("/events")
      .query({ q: "Unaith Listed" })
      .expect(200);
  });

  it("lists only future published events and omits internal fields", async () => {
    const event = await createPublicEvent("integration-public-event-visible", {
      title: "Public Visible Event",
      description: "Public visible description",
      status: "PUBLISHED"
    });
    await createPublicEvent("integration-public-event-draft-hidden", {
      title: "Public Visible Draft",
      status: "DRAFT"
    });
    await createPublicEvent("integration-public-event-approved-hidden", {
      title: "Public Visible Approved",
      status: "APPROVED"
    });

    const response = await request(app.getHttpServer())
      .get("/events")
      .query({ q: "Public Visible" })
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      id: event.id,
      title: "Public Visible Event",
      status: "PUBLISHED",
      club: {
        id: clubId,
        name: expect.any(String),
        slug: "agu-yazilim-kulubu"
      }
    });
    expect(response.body.items[0]).not.toHaveProperty("createdById");
    expect(response.body.items[0]).not.toHaveProperty("qrTokenHash");
    expect(response.body.items[0]).not.toHaveProperty("reviews");
    expect(response.body.items[0]).not.toHaveProperty("auditLogs");
  });

  it("excludes past published events by default", async () => {
    const futureEvent = await createPublicEvent("integration-public-event-default-future", {
      title: "Public Default Window",
      startsAt: new Date("2026-08-12T11:00:00.000Z"),
      status: "PUBLISHED"
    });
    await createPublicEvent("integration-public-event-default-past", {
      title: "Public Default Window",
      startsAt: new Date("2026-07-01T11:00:00.000Z"),
      status: "PUBLISHED"
    });

    const response = await request(app.getHttpServer())
      .get("/events")
      .query({ q: "Public Default Window" })
      .expect(200);

    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([futureEvent.id]);
  });

  it("filters public events by inclusive from and to", async () => {
    const inside = await createPublicEvent("integration-public-event-range-inside", {
      title: "Public Range Event",
      startsAt: new Date("2026-08-10T11:00:00.000Z"),
      status: "PUBLISHED"
    });
    await createPublicEvent("integration-public-event-range-outside", {
      title: "Public Range Event",
      startsAt: new Date("2026-08-12T11:00:00.000Z"),
      status: "PUBLISHED"
    });

    const response = await request(app.getHttpServer())
      .get("/events")
      .query({
        q: "Public Range Event",
        from: "2026-08-10T11:00:00Z",
        to: "2026-08-10T11:00:00Z"
      })
      .expect(200);

    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([inside.id]);
  });

  it("filters public events by clubId", async () => {
    const event = await createPublicEvent("integration-public-event-club-filter", {
      title: "Public Club Filter",
      status: "PUBLISHED"
    });
    await createPublicEvent("integration-public-event-other-club-filter", {
      title: "Public Club Filter",
      clubId: otherClubId,
      status: "PUBLISHED"
    });

    const response = await request(app.getHttpServer())
      .get("/events")
      .query({ q: "Public Club Filter", clubId })
      .expect(200);

    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([event.id]);
  });

  it("filters public events by q in title and description", async () => {
    const titleMatch = await createPublicEvent("integration-public-event-q-title", {
      title: "Public Search Needle",
      description: "Different text",
      status: "PUBLISHED"
    });
    const descriptionMatch = await createPublicEvent("integration-public-event-q-description", {
      title: "Different title",
      description: "Public search needle description",
      status: "PUBLISHED"
    });

    const response = await request(app.getHttpServer())
      .get("/events")
      .query({ q: " search needle " })
      .expect(200);

    expect(response.body.items.map((item: { id: string }) => item.id).sort()).toEqual(
      [titleMatch.id, descriptionMatch.id].sort()
    );
  });

  it("returns pagination metadata and deterministic ordering", async () => {
    const sameStart = new Date("2026-08-15T11:00:00.000Z");
    const first = await createPublicEvent("integration-public-event-page-1", {
      title: "Public Pagination Event",
      startsAt: sameStart,
      status: "PUBLISHED"
    });
    const second = await createPublicEvent("integration-public-event-page-2", {
      title: "Public Pagination Event",
      startsAt: sameStart,
      status: "PUBLISHED"
    });
    const third = await createPublicEvent("integration-public-event-page-3", {
      title: "Public Pagination Event",
      startsAt: new Date("2026-08-16T11:00:00.000Z"),
      status: "PUBLISHED"
    });

    const response = await request(app.getHttpServer())
      .get("/events")
      .query({ q: "Public Pagination Event", page: 1, pageSize: 2 })
      .expect(200);

    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 2,
      totalItems: 3,
      totalPages: 2
    });
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual(
      [first.id, second.id].sort()
    );

    const secondPage = await request(app.getHttpServer())
      .get("/events")
      .query({ q: "Public Pagination Event", page: 2, pageSize: 2 })
      .expect(200);
    expect(secondPage.body.items.map((item: { id: string }) => item.id)).toEqual([third.id]);
  });

  it("returns 400 for invalid public list query values", async () => {
    await request(app.getHttpServer())
      .get("/events")
      .query({ from: "not-a-date" })
      .expect(400);
    await request(app.getHttpServer())
      .get("/events")
      .query({ from: "2026-08-11T00:00:00Z", to: "2026-08-10T00:00:00Z" })
      .expect(400);
    await request(app.getHttpServer()).get("/events").query({ page: 0 }).expect(400);
    await request(app.getHttpServer()).get("/events").query({ pageSize: 101 }).expect(400);
  });

  it("returns public detail only for published events", async () => {
    const event = await createPublicEvent("integration-public-event-detail", {
      title: "Public Detail Event",
      status: "PUBLISHED"
    });

    const response = await request(app.getHttpServer()).get(`/events/${event.id}`).expect(200);

    expect(response.body).toMatchObject({
      id: event.id,
      title: "Public Detail Event",
      status: "PUBLISHED",
      club: {
        id: clubId,
        name: expect.any(String),
        slug: "agu-yazilim-kulubu"
      }
    });
    expect(response.body).not.toHaveProperty("createdById");
    expect(response.body).not.toHaveProperty("qrTokenHash");
  });

  it("hides draft and approved public detail with 404", async () => {
    const draft = await createPublicEvent("integration-public-event-detail-draft", {
      title: "Public Hidden Draft Detail",
      status: "DRAFT"
    });
    const approved = await createPublicEvent("integration-public-event-detail-approved", {
      title: "Public Hidden Approved Detail",
      status: "APPROVED"
    });

    await request(app.getHttpServer()).get(`/events/${draft.id}`).expect(404);
    await request(app.getHttpServer()).get(`/events/${approved.id}`).expect(404);
  });

  it("returns 404 for unknown public detail and 400 for invalid detail id", async () => {
    await request(app.getHttpServer())
      .get("/events/00000000-0000-4000-8000-000000000000")
      .expect(404);
    await request(app.getHttpServer()).get("/events/not-a-valid-id").expect(400);
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

  it("returns 401 when reviewing without authentication", async () => {
    const event = await createSubmittedEvent("integration-review-event-unauth");

    await request(app.getHttpServer()).post(`/events/${event.id}/approve`).expect(401);
  });

  it("allows a press editor to request changes and writes review and audit", async () => {
    const event = await createSubmittedEvent("integration-review-event-changes");

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/request-changes`)
      .set("Cookie", pressCookie)
      .send({ comment: " Etkinlik gorseli guncellenmeli. " })
      .expect(200);

    expect(response.body).toMatchObject({
      id: event.id,
      clubId,
      createdById: clubAdminId,
      status: "CHANGES_REQUESTED"
    });

    await expectReviewAndAudit(event.id, "CHANGES_REQUESTED", "EVENT_CHANGES_REQUESTED");
  });

  it("allows a press editor to reject", async () => {
    const event = await createSubmittedEvent("integration-review-event-reject");

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/reject`)
      .set("Cookie", pressCookie)
      .send({ comment: "Etkinlik mevcut kampus kurallarina uygun degil." })
      .expect(200);

    expect(response.body).toMatchObject({
      id: event.id,
      status: "REJECTED"
    });
    await expectReviewAndAudit(event.id, "REJECTED", "EVENT_REJECTED");
  });

  it("allows a press editor to approve without publishing", async () => {
    const event = await createSubmittedEvent("integration-review-event-approve");

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/approve`)
      .set("Cookie", pressCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      id: event.id,
      status: "APPROVED"
    });

    const storedEvent = await prisma.event.findUniqueOrThrow({
      where: { id: event.id }
    });
    expect(storedEvent.status).toBe("APPROVED");
    expect(storedEvent.createdById).toBe(clubAdminId);
    expect(storedEvent.clubId).toBe(clubId);
    await expectReviewAndAudit(event.id, "APPROVED", "EVENT_APPROVED");
  });

  it("returns 403 for a club admin reviewing their own event", async () => {
    const event = await createSubmittedEvent("integration-review-event-club-admin");

    await request(app.getHttpServer())
      .post(`/events/${event.id}/approve`)
      .set("Cookie", clubAdminCookie)
      .expect(403);
  });

  it("returns 404 for reviewing an unknown event", async () => {
    await request(app.getHttpServer())
      .post("/events/00000000-0000-4000-8000-000000000000/approve")
      .set("Cookie", pressCookie)
      .expect(404);
  });

  it("returns 400 for an invalid review event id", async () => {
    await request(app.getHttpServer())
      .post("/events/not-a-valid-id/approve")
      .set("Cookie", pressCookie)
      .expect(400);
  });

  it("returns 409 when reviewing a draft event", async () => {
    const event = await createDraftEvent("integration-review-event-draft");

    await request(app.getHttpServer())
      .post(`/events/${event.id}/approve`)
      .set("Cookie", pressCookie)
      .expect(409);
  });

  it("returns 400 for blank request-changes and reject comments", async () => {
    const changesEvent = await createSubmittedEvent("integration-review-event-blank-changes");
    const rejectEvent = await createSubmittedEvent("integration-review-event-blank-reject");

    await request(app.getHttpServer())
      .post(`/events/${changesEvent.id}/request-changes`)
      .set("Cookie", pressCookie)
      .send({ comment: " " })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/events/${rejectEvent.id}/reject`)
      .set("Cookie", pressCookie)
      .send({ comment: "" })
      .expect(400);
  });

  it("returns 409 for a second review decision and writes only one review and audit", async () => {
    const event = await createSubmittedEvent("integration-review-event-repeat");

    await request(app.getHttpServer())
      .post(`/events/${event.id}/approve`)
      .set("Cookie", pressCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/events/${event.id}/reject`)
      .set("Cookie", pressCookie)
      .send({ comment: "Second decision." })
      .expect(409);

    const reviewCount = await prisma.eventReview.count({ where: { eventId: event.id } });
    const auditCount = await prisma.auditLog.count({
      where: {
        entityType: "Event",
        entityId: event.id,
        action: { in: ["EVENT_APPROVED", "EVENT_REJECTED", "EVENT_CHANGES_REQUESTED"] }
      }
    });
    expect(reviewCount).toBe(1);
    expect(auditCount).toBe(1);
  });

  it("does not create review or audit for failed review", async () => {
    const event = await createSubmittedEvent("integration-review-event-failed");

    await request(app.getHttpServer())
      .post(`/events/${event.id}/approve`)
      .set("Cookie", clubAdminCookie)
      .expect(403);

    const reviewCount = await prisma.eventReview.count({ where: { eventId: event.id } });
    const auditCount = await prisma.auditLog.count({
      where: {
        entityType: "Event",
        entityId: event.id,
        action: { in: ["EVENT_APPROVED", "EVENT_REJECTED", "EVENT_CHANGES_REQUESTED"] }
      }
    });
    expect(reviewCount).toBe(0);
    expect(auditCount).toBe(0);
  });

  it("allows only one of two concurrent review decisions", async () => {
    const event = await createSubmittedEvent("integration-review-event-concurrent");

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/events/${event.id}/approve`)
        .set("Cookie", pressCookie),
      request(app.getHttpServer())
        .post(`/events/${event.id}/reject`)
        .set("Cookie", pressCookie)
        .send({ comment: "Concurrent rejection." })
    ]);

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 409]);
    expect(await prisma.eventReview.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("returns 401 when publishing without authentication", async () => {
    const event = await createApprovedEvent("integration-publish-event-unauth");

    await request(app.getHttpServer()).post(`/events/${event.id}/publish`).expect(401);
  });

  it("publishes an approved event for a press editor and writes audit", async () => {
    const event = await createApprovedEvent("integration-publish-event-success");

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .set("Cookie", pressCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      id: event.id,
      clubId,
      createdById: clubAdminId,
      status: "PUBLISHED"
    });
    expect(response.body.publishedAt).toEqual(expect.any(String));

    const storedEvent = await prisma.event.findUniqueOrThrow({
      where: { id: event.id }
    });
    expect(storedEvent.status).toBe("PUBLISHED");
    expect(storedEvent.publishedAt).toBeInstanceOf(Date);
    expect(storedEvent.createdById).toBe(clubAdminId);
    expect(storedEvent.clubId).toBe(clubId);

    const audits = await prisma.auditLog.findMany({
      where: {
        entityType: "Event",
        entityId: event.id,
        action: "EVENT_PUBLISHED"
      }
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: pressEditorId,
      before: { status: "APPROVED" },
      after: { status: "PUBLISHED" }
    });
  });

  it("returns 403 for a club admin publishing their own event", async () => {
    const event = await createApprovedEvent("integration-publish-event-club-admin");

    await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .set("Cookie", clubAdminCookie)
      .expect(403);
  });

  it("returns 404 for publishing an unknown event", async () => {
    await request(app.getHttpServer())
      .post("/events/00000000-0000-4000-8000-000000000000/publish")
      .set("Cookie", pressCookie)
      .expect(404);
  });

  it("returns 400 for an invalid publish event id", async () => {
    await request(app.getHttpServer())
      .post("/events/not-a-valid-id/publish")
      .set("Cookie", pressCookie)
      .expect(400);
  });

  it("returns 409 when publishing a submitted event", async () => {
    const event = await createSubmittedEvent("integration-publish-event-submitted");

    await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .set("Cookie", pressCookie)
      .expect(409);
  });

  it("returns 409 for a second publish and writes only one audit", async () => {
    const event = await createApprovedEvent("integration-publish-event-repeat");

    await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .set("Cookie", pressCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .set("Cookie", pressCookie)
      .expect(409);

    const auditCount = await prisma.auditLog.count({
      where: {
        entityType: "Event",
        entityId: event.id,
        action: "EVENT_PUBLISHED"
      }
    });
    expect(auditCount).toBe(1);
  });

  it("allows only one of two concurrent publish requests", async () => {
    const event = await createApprovedEvent("integration-publish-event-concurrent");

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/events/${event.id}/publish`)
        .set("Cookie", pressCookie),
      request(app.getHttpServer())
        .post(`/events/${event.id}/publish`)
        .set("Cookie", pressCookie)
    ]);

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 409]);
    expect(
      await prisma.auditLog.count({
        where: {
          entityType: "Event",
          entityId: event.id,
          action: "EVENT_PUBLISHED"
        }
      })
    ).toBe(1);
  });

  it("does not create audit for failed publish", async () => {
    const event = await createApprovedEvent("integration-publish-event-failed");

    await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .set("Cookie", clubAdminCookie)
      .expect(403);

    const auditCount = await prisma.auditLog.count({
      where: {
        entityType: "Event",
        entityId: event.id,
        action: "EVENT_PUBLISHED"
      }
    });
    expect(auditCount).toBe(0);
  });

  it("returns 401 when registering without authentication", async () => {
    const event = await createPublicEvent("integration-registration-event-unauth", {
      title: "Registration Unauth Event",
      status: "PUBLISHED"
    });

    await request(app.getHttpServer()).post(`/events/${event.id}/register`).expect(401);
  });

  it("registers a student for a future published event", async () => {
    const event = await createPublicEvent("integration-registration-event-success", {
      title: "Registration Success Event",
      status: "PUBLISHED"
    });

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/register`)
      .set("Cookie", studentCookie)
      .expect(201);

    expect(response.body).toMatchObject({
      eventId: event.id,
      userId: studentId,
      registeredAt: expect.any(String)
    });

    const registration = await prisma.eventRegistration.findUniqueOrThrow({
      where: {
        eventId_userId: {
          eventId: event.id,
          userId: studentId
        }
      }
    });
    expect(registration.eventId).toBe(event.id);
    expect(registration.userId).toBe(studentId);
  });

  it("returns 409 for a duplicate registration", async () => {
    const event = await createPublicEvent("integration-registration-event-duplicate", {
      title: "Registration Duplicate Event",
      status: "PUBLISHED"
    });

    await request(app.getHttpServer())
      .post(`/events/${event.id}/register`)
      .set("Cookie", studentCookie)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/events/${event.id}/register`)
      .set("Cookie", studentCookie)
      .expect(409);
  });

  it("returns 403 for a user without the student role", async () => {
    const event = await createPublicEvent("integration-registration-event-non-student", {
      title: "Registration Non Student Event",
      status: "PUBLISHED"
    });

    await request(app.getHttpServer())
      .post(`/events/${event.id}/register`)
      .set("Cookie", pressCookie)
      .expect(403);
  });

  it("returns 404 for a non-public event registration", async () => {
    const event = await createPublicEvent("integration-registration-event-draft", {
      title: "Registration Hidden Event",
      status: "DRAFT"
    });

    await request(app.getHttpServer())
      .post(`/events/${event.id}/register`)
      .set("Cookie", studentCookie)
      .expect(404);
  });

  it("returns 404 for registering an unknown event", async () => {
    await request(app.getHttpServer())
      .post("/events/00000000-0000-4000-8000-000000000000/register")
      .set("Cookie", studentCookie)
      .expect(404);
  });

  it("returns 400 for an invalid registration event id", async () => {
    await request(app.getHttpServer())
      .post("/events/not-a-valid-id/register")
      .set("Cookie", studentCookie)
      .expect(400);
  });

  it("returns 409 for an event that has already started", async () => {
    const event = await createPublicEvent("integration-registration-event-started", {
      title: "Registration Started Event",
      startsAt: new Date("2026-07-01T11:00:00.000Z"),
      status: "PUBLISHED"
    });

    await request(app.getHttpServer())
      .post(`/events/${event.id}/register`)
      .set("Cookie", studentCookie)
      .expect(409);
  });

  it("returns 409 when event capacity is full", async () => {
    const event = await createPublicEvent("integration-registration-event-full", {
      title: "Registration Full Event",
      status: "PUBLISHED",
      capacity: 1
    });

    await request(app.getHttpServer())
      .post(`/events/${event.id}/register`)
      .set("Cookie", clubMemberCookie)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/events/${event.id}/register`)
      .set("Cookie", studentCookie)
      .expect(409);
  });

  it("does not exceed capacity for concurrent final-seat registrations", async () => {
    const event = await createPublicEvent("integration-registration-event-concurrent", {
      title: "Registration Concurrent Event",
      status: "PUBLISHED",
      capacity: 1
    });

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/events/${event.id}/register`)
        .set("Cookie", studentCookie),
      request(app.getHttpServer())
        .post(`/events/${event.id}/register`)
        .set("Cookie", clubMemberCookie)
    ]);

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(await prisma.eventRegistration.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("returns 401 when checking registration status without authentication", async () => {
    const event = await createPublicEvent("integration-registration-event-status-unauth", {
      title: "Registration Status Unauth Event",
      status: "PUBLISHED"
    });

    await request(app.getHttpServer()).get(`/events/${event.id}/registration`).expect(401);
  });

  it("returns registered false when the student has no registration", async () => {
    const event = await createPublicEvent("integration-registration-event-status-empty", {
      title: "Registration Status Empty Event",
      status: "PUBLISHED"
    });

    const response = await request(app.getHttpServer())
      .get(`/events/${event.id}/registration`)
      .set("Cookie", studentCookie)
      .expect(200);

    expect(response.body).toEqual({
      registered: false,
      registration: null
    });
  });

  it("returns only the current student's registration status", async () => {
    const event = await createPublicEvent("integration-registration-event-status-current-user", {
      title: "Registration Status Current User Event",
      status: "PUBLISHED"
    });

    await prisma.eventRegistration.create({
      data: {
        eventId: event.id,
        userId: clubMemberId
      }
    });

    const response = await request(app.getHttpServer())
      .get(`/events/${event.id}/registration`)
      .set("Cookie", studentCookie)
      .expect(200);

    expect(response.body).toEqual({
      registered: false,
      registration: null
    });
  });

  it("returns the authenticated student's registration status when registered", async () => {
    const event = await createPublicEvent("integration-registration-event-status-registered", {
      title: "Registration Status Registered Event",
      status: "PUBLISHED"
    });

    const registration = await prisma.eventRegistration.create({
      data: {
        eventId: event.id,
        userId: studentId
      }
    });

    const response = await request(app.getHttpServer())
      .get(`/events/${event.id}/registration`)
      .set("Cookie", studentCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      registered: true,
      registration: {
        id: registration.id,
        eventId: event.id,
        userId: studentId,
        registeredAt: expect.any(String)
      }
    });
  });

  it("returns 403 for registration status when the user is not a student", async () => {
    const event = await createPublicEvent("integration-registration-event-status-non-student", {
      title: "Registration Status Non Student Event",
      status: "PUBLISHED"
    });

    await request(app.getHttpServer())
      .get(`/events/${event.id}/registration`)
      .set("Cookie", pressCookie)
      .expect(403);
  });

  it("returns 404 for registration status on non-public events", async () => {
    const event = await createPublicEvent("integration-registration-event-status-draft", {
      title: "Registration Status Draft Event",
      status: "DRAFT"
    });

    await request(app.getHttpServer())
      .get(`/events/${event.id}/registration`)
      .set("Cookie", studentCookie)
      .expect(404);
  });

  it("returns 401 when issuing attendance token without authentication", async () => {
    const event = await createPublicEvent("integration-registration-event-token-unauth", {
      title: "Attendance Token Unauth Event",
      startsAt: new Date(Date.now() + 10 * 60 * 1000),
      status: "PUBLISHED"
    });

    await request(app.getHttpServer()).post(`/events/${event.id}/attendance-token`).expect(401);
  });

  it("issues an attendance token for an authorized club admin", async () => {
    const event = await createPublicEvent("integration-registration-event-token-success", {
      title: "Attendance Token Success Event",
      startsAt: new Date(Date.now() + 10 * 60 * 1000),
      status: "PUBLISHED"
    });

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/attendance-token`)
      .set("Cookie", clubAdminCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      eventId: event.id,
      token: expect.any(String),
      expiresAt: expect.any(String)
    });

    const storedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(storedEvent.qrTokenHash).toBeNull();
  });

  it("returns 403 when an unauthorized user issues attendance token", async () => {
    const event = await createPublicEvent("integration-registration-event-token-forbidden", {
      title: "Attendance Token Forbidden Event",
      startsAt: new Date(Date.now() + 10 * 60 * 1000),
      status: "PUBLISHED"
    });

    await request(app.getHttpServer())
      .post(`/events/${event.id}/attendance-token`)
      .set("Cookie", pressCookie)
      .expect(403);
  });

  it("checks in a registered student with a valid token", async () => {
    const event = await createPublicEvent("integration-registration-event-checkin-success", {
      title: "Attendance Check In Success Event",
      startsAt: new Date(Date.now() + 10 * 60 * 1000),
      status: "PUBLISHED"
    });
    await prisma.eventRegistration.create({ data: { eventId: event.id, userId: studentId } });
    const tokenResponse = await request(app.getHttpServer())
      .post(`/events/${event.id}/attendance-token`)
      .set("Cookie", clubAdminCookie)
      .expect(200);

    const response = await request(app.getHttpServer())
      .post("/attendance/check-in")
      .set("Cookie", studentCookie)
      .send({ token: tokenResponse.body.token })
      .expect(201);

    expect(response.body).toMatchObject({
      eventId: event.id,
      userId: studentId,
      checkedInAt: expect.any(String)
    });

    const attendance = await prisma.attendance.findUniqueOrThrow({
      where: {
        eventId_userId: {
          eventId: event.id,
          userId: studentId
        }
      }
    });
    expect(attendance.eventId).toBe(event.id);
    expect(attendance.userId).toBe(studentId);
  });

  it("returns 409 for duplicate check-in", async () => {
    const event = await createPublicEvent("integration-registration-event-checkin-duplicate", {
      title: "Attendance Check In Duplicate Event",
      startsAt: new Date(Date.now() + 10 * 60 * 1000),
      status: "PUBLISHED"
    });
    await prisma.eventRegistration.create({ data: { eventId: event.id, userId: studentId } });
    const tokenResponse = await request(app.getHttpServer())
      .post(`/events/${event.id}/attendance-token`)
      .set("Cookie", clubAdminCookie)
      .expect(200);

    await request(app.getHttpServer())
      .post("/attendance/check-in")
      .set("Cookie", studentCookie)
      .send({ token: tokenResponse.body.token })
      .expect(201);
    await request(app.getHttpServer())
      .post("/attendance/check-in")
      .set("Cookie", studentCookie)
      .send({ token: tokenResponse.body.token })
      .expect(409);
  });

  it("returns 409 when an unregistered student checks in", async () => {
    const event = await createPublicEvent("integration-registration-event-checkin-unregistered", {
      title: "Attendance Check In Unregistered Event",
      startsAt: new Date(Date.now() + 10 * 60 * 1000),
      status: "PUBLISHED"
    });
    const tokenResponse = await request(app.getHttpServer())
      .post(`/events/${event.id}/attendance-token`)
      .set("Cookie", clubAdminCookie)
      .expect(200);

    await request(app.getHttpServer())
      .post("/attendance/check-in")
      .set("Cookie", studentCookie)
      .send({ token: tokenResponse.body.token })
      .expect(409);
  });

  it("returns 400 for wrong and expired tokens", async () => {
    const wrongEvent = await createPublicEvent("integration-registration-event-checkin-wrong", {
      title: "Attendance Check In Wrong Token Event",
      startsAt: new Date(Date.now() + 10 * 60 * 1000),
      status: "PUBLISHED"
    });
    await prisma.eventRegistration.create({ data: { eventId: wrongEvent.id, userId: studentId } });
    await request(app.getHttpServer())
      .post(`/events/${wrongEvent.id}/attendance-token`)
      .set("Cookie", clubAdminCookie)
      .expect(200);

    await request(app.getHttpServer())
      .post("/attendance/check-in")
      .set("Cookie", studentCookie)
      .send({ token: "wrong-token" })
      .expect(400);
  });

  it("allows only one concurrent check-in", async () => {
    const event = await createPublicEvent("integration-registration-event-checkin-concurrent", {
      title: "Attendance Check In Concurrent Event",
      startsAt: new Date(Date.now() + 10 * 60 * 1000),
      status: "PUBLISHED"
    });
    await prisma.eventRegistration.create({ data: { eventId: event.id, userId: studentId } });
    const tokenResponse = await request(app.getHttpServer())
      .post(`/events/${event.id}/attendance-token`)
      .set("Cookie", clubAdminCookie)
      .expect(200);

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post("/attendance/check-in")
        .set("Cookie", studentCookie)
        .send({ token: tokenResponse.body.token }),
      request(app.getHttpServer())
        .post("/attendance/check-in")
        .set("Cookie", studentCookie)
        .send({ token: tokenResponse.body.token })
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.attendance.count({ where: { eventId: event.id, userId: studentId } })).toBe(1);
  });

  it("returns 401 when reading attendance summary without authentication", async () => {
    const event = await createPublicEvent("integration-summary-event-unauth", {
      title: "Attendance Summary Unauth Event",
      status: "PUBLISHED"
    });

    await request(app.getHttpServer()).get(`/events/${event.id}/attendance-summary`).expect(401);
  });

  it("returns attendance summary metrics for an authorized club admin", async () => {
    const event = await createPublicEvent("integration-summary-event-success", {
      title: "Attendance Summary Success Event",
      status: "PUBLISHED",
      capacity: 100
    });
    await prisma.eventRegistration.createMany({
      data: [
        { eventId: event.id, userId: studentId },
        { eventId: event.id, userId: clubMemberId },
        { eventId: event.id, userId: clubAdminId }
      ]
    });
    await prisma.attendance.createMany({
      data: [
        { eventId: event.id, userId: studentId, source: "QR" },
        { eventId: event.id, userId: clubMemberId, source: "QR" }
      ]
    });

    const response = await request(app.getHttpServer())
      .get(`/events/${event.id}/attendance-summary`)
      .set("Cookie", clubAdminCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      event: {
        id: event.id,
        title: "Attendance Summary Success Event",
        status: "PUBLISHED",
        capacity: 100
      },
      summary: {
        registeredCount: 3,
        attendanceCount: 2,
        absentCount: 1,
        capacityRemaining: 97,
        registrationRate: 3,
        attendanceRate: 66.67
      },
      attendees: [
        {
          userId: expect.any(String),
          displayName: expect.any(String),
          email: expect.any(String),
          registeredAt: expect.any(String),
          checkedInAt: expect.any(String)
        },
        {
          userId: expect.any(String),
          displayName: expect.any(String),
          email: expect.any(String),
          registeredAt: expect.any(String),
          checkedInAt: expect.any(String)
        }
      ],
      pagination: {
        page: 1,
        pageSize: 50,
        totalItems: 2,
        totalPages: 1
      }
    });
    expect(response.body.event.startsAt).toEqual(expect.any(String));
    expect(response.body.event.endsAt).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain("token");
    expect(JSON.stringify(response.body)).not.toContain("password");
    expect(response.body).not.toHaveProperty("registrations");
  });

  it("supports search filtering and pagination for attendees without affecting summary metrics", async () => {
    const event = await createPublicEvent("integration-summary-event-search", {
      title: "Attendance Summary Search Event",
      status: "PUBLISHED",
      capacity: 50
    });
    await prisma.eventRegistration.createMany({
      data: [
        { eventId: event.id, userId: studentId },
        { eventId: event.id, userId: clubMemberId }
      ]
    });
    await prisma.attendance.createMany({
      data: [
        { eventId: event.id, userId: studentId, source: "QR" },
        { eventId: event.id, userId: clubMemberId, source: "QR" }
      ]
    });

    const searchRes = await request(app.getHttpServer())
      .get(`/events/${event.id}/attendance-summary?q=Student&page=1&pageSize=10`)
      .set("Cookie", clubAdminCookie)
      .expect(200);

    expect(searchRes.body.summary.attendanceCount).toBe(2);
    expect(searchRes.body.attendees.length).toBe(1);
    expect(searchRes.body.attendees[0].userId).toBe(studentId);
    expect(searchRes.body.pagination).toMatchObject({
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1
    });

    await request(app.getHttpServer())
      .get(`/events/${event.id}/attendance-summary?pageSize=150`)
      .set("Cookie", clubAdminCookie)
      .expect(400);
  });

  it("returns 403 for another club admin, student, and press editor attendance summary access", async () => {
    const event = await createPublicEvent("integration-summary-event-forbidden", {
      title: "Attendance Summary Forbidden Event",
      status: "PUBLISHED"
    });

    await request(app.getHttpServer())
      .get(`/events/${event.id}/attendance-summary`)
      .set("Cookie", otherClubAdminCookie)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/events/${event.id}/attendance-summary`)
      .set("Cookie", studentCookie)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/events/${event.id}/attendance-summary`)
      .set("Cookie", pressCookie)
      .expect(403);
  });

  it("allows a system admin to view attendance summary", async () => {
    const event = await createPublicEvent("integration-summary-event-system-admin", {
      title: "Attendance Summary System Admin Event",
      status: "PUBLISHED"
    });

    await request(app.getHttpServer())
      .get(`/events/${event.id}/attendance-summary`)
      .set("Cookie", systemAdminCookie)
      .expect(200);
  });

  it("returns 404 for unknown attendance summary event and 400 for invalid id", async () => {
    await request(app.getHttpServer())
      .get("/events/00000000-0000-4000-8000-000000000000/attendance-summary")
      .set("Cookie", clubAdminCookie)
      .expect(404);
    await request(app.getHttpServer())
      .get("/events/not-a-valid-id/attendance-summary")
      .set("Cookie", clubAdminCookie)
      .expect(400);
  });

  it("returns 409 for draft or submitted attendance summary events", async () => {
    const draft = await createPublicEvent("integration-summary-event-draft", {
      title: "Attendance Summary Draft Event",
      status: "DRAFT"
    });
    const submitted = await createPublicEvent("integration-summary-event-submitted", {
      title: "Attendance Summary Submitted Event",
      status: "SUBMITTED"
    });

    await request(app.getHttpServer())
      .get(`/events/${draft.id}/attendance-summary`)
      .set("Cookie", clubAdminCookie)
      .expect(409);
    await request(app.getHttpServer())
      .get(`/events/${submitted.id}/attendance-summary`)
      .set("Cookie", clubAdminCookie)
      .expect(409);
  });

  it("returns zero metrics for an event without registrations", async () => {
    const event = await createPublicEvent("integration-summary-event-empty", {
      title: "Attendance Summary Empty Event",
      status: "PUBLISHED",
      capacity: 20
    });

    const response = await request(app.getHttpServer())
      .get(`/events/${event.id}/attendance-summary`)
      .set("Cookie", clubAdminCookie)
      .expect(200);

    expect(response.body.summary).toMatchObject({
      registeredCount: 0,
      attendanceCount: 0,
      absentCount: 0,
      capacityRemaining: 20,
      attendanceRate: 0
    });
  });

  it("returns null remaining capacity for unlimited attendance summary events", async () => {
    const event = await createPublicEvent("integration-summary-event-unlimited", {
      title: "Attendance Summary Unlimited Event",
      status: "PUBLISHED",
      capacity: null
    });

    const response = await request(app.getHttpServer())
      .get(`/events/${event.id}/attendance-summary`)
      .set("Cookie", clubAdminCookie)
      .expect(200);

    expect(response.body.summary.capacityRemaining).toBeNull();
  });

  it("keeps existing submit, review, and publish routes working alongside public detail", async () => {
    const draft = await createDraftEvent("integration-public-event-route-submit");
    await request(app.getHttpServer())
      .post(`/events/${draft.id}/submit`)
      .set("Cookie", clubAdminCookie)
      .expect(200);

    const submitted = await createSubmittedEvent("integration-public-event-route-review");
    await request(app.getHttpServer())
      .post(`/events/${submitted.id}/approve`)
      .set("Cookie", pressCookie)
      .expect(200);

    const approved = await createApprovedEvent("integration-public-event-route-publish");
    await request(app.getHttpServer())
      .post(`/events/${approved.id}/publish`)
      .set("Cookie", pressCookie)
      .expect(200);
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

  async function createSubmittedEvent(slugPrefix: string) {
    return prisma.event.create({
      data: {
        clubId,
        createdById: clubAdminId,
        title: `Review Integration Event ${Date.now()}`,
        slug: `${slugPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        description: "Review integration event description",
        startsAt: new Date("2026-08-10T11:00:00.000Z"),
        endsAt: new Date("2026-08-10T13:00:00.000Z"),
        location: "AGU Buyuk Amfi",
        capacity: 100,
        status: "SUBMITTED"
      }
    });
  }

  async function createApprovedEvent(slugPrefix: string) {
    return prisma.event.create({
      data: {
        clubId,
        createdById: clubAdminId,
        title: `Publish Integration Event ${Date.now()}`,
        slug: `${slugPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        description: "Publish integration event description",
        startsAt: new Date("2026-08-10T11:00:00.000Z"),
        endsAt: new Date("2026-08-10T13:00:00.000Z"),
        location: "AGU Buyuk Amfi",
        capacity: 100,
        status: "APPROVED"
      }
    });
  }

  async function createPublicEvent(
    slugPrefix: string,
    input: {
      title: string;
      description?: string;
      startsAt?: Date;
      clubId?: string;
      capacity?: number | null;
      status: "DRAFT" | "SUBMITTED" | "CHANGES_REQUESTED" | "REJECTED" | "APPROVED" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
    }
  ) {
    const startsAt = input.startsAt ?? new Date("2026-08-10T11:00:00.000Z");
    return prisma.event.create({
      data: {
        clubId: input.clubId ?? clubId,
        createdById: clubAdminId,
        title: input.title,
        slug: `${slugPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        description: input.description ?? `${input.title} description`,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
        location: "AGU Buyuk Amfi",
        capacity: input.capacity === undefined ? 100 : input.capacity,
        status: input.status,
        publishedAt: input.status === "PUBLISHED" ? new Date("2026-07-23T12:00:00.000Z") : null
      }
    });
  }

  async function expectReviewAndAudit(
    eventId: string,
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
    action: string
  ) {
    const reviews = await prisma.eventReview.findMany({
      where: { eventId, decision }
    });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.reviewerId).toBe(pressEditorId);

    const audits = await prisma.auditLog.findMany({
      where: {
        entityType: "Event",
        entityId: eventId,
        action
      }
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: pressEditorId,
      before: { status: "SUBMITTED" },
      after: { status: decision }
    });
  }

  describe("GET /events/:eventId/revision", () => {
    it("returns 401 without auth cookie", async () => {
      await request(app.getHttpServer())
        .get("/events/11111111-1111-4111-8111-111111111111/revision")
        .expect(401);
    });

    it("returns 400 for invalid UUID", async () => {
      await request(app.getHttpServer())
        .get("/events/invalid-uuid/revision")
        .set("Cookie", clubAdminCookie)
        .expect(400);
    });

    it("returns 404 for non-existent event", async () => {
      await request(app.getHttpServer())
        .get("/events/99999999-9999-4999-8999-999999999999/revision")
        .set("Cookie", clubAdminCookie)
        .expect(404);
    });

    it("returns 403 for student or unauthorized user", async () => {
      const event = await createDraftEventInDb(clubId, "DRAFT");
      await request(app.getHttpServer())
        .get(`/events/${event.id}/revision`)
        .set("Cookie", studentCookie)
        .expect(403);
    });

    it("returns 409 when event status is not CHANGES_REQUESTED", async () => {
      const event = await createDraftEventInDb(clubId, "DRAFT");
      await request(app.getHttpServer())
        .get(`/events/${event.id}/revision`)
        .set("Cookie", clubAdminCookie)
        .expect(409);
    });

    it("returns 200 with revision detail and latest change request for active club ADMIN", async () => {
      const event = await createDraftEventInDb(clubId, "CHANGES_REQUESTED");
      await prisma.eventReview.create({
        data: {
          eventId: event.id,
          reviewerId: pressEditorId,
          decision: "CHANGES_REQUESTED",
          comment: "Açıklamayı daha detaylı yazınız."
        }
      });

      const response = await request(app.getHttpServer())
        .get(`/events/${event.id}/revision`)
        .set("Cookie", clubAdminCookie)
        .expect(200);

      expect(response.body.event).toMatchObject({
        id: event.id,
        status: "CHANGES_REQUESTED",
        title: event.title
      });
      expect(response.body.latestChangeRequest).toMatchObject({
        comment: "Açıklamayı daha detaylı yazınız."
      });
    });
  });

  describe("PATCH /events/:eventId/revision", () => {
    it("returns 401 without auth", async () => {
      await request(app.getHttpServer())
        .patch("/events/11111111-1111-4111-8111-111111111111/revision")
        .send({})
        .expect(401);
    });

    it("returns 400 for invalid body or endsAt <= startsAt", async () => {
      const event = await createDraftEventInDb(clubId, "CHANGES_REQUESTED");
      await request(app.getHttpServer())
        .patch(`/events/${event.id}/revision`)
        .set("Cookie", clubAdminCookie)
        .send({
          title: "Valid Title",
          description: "Valid Description",
          startsAt: "2026-08-10T16:00:00+03:00",
          endsAt: "2026-08-10T14:00:00+03:00",
          location: "AGU Amfi"
        })
        .expect(400);
    });

    it("returns 409 if status is not CHANGES_REQUESTED", async () => {
      const event = await createDraftEventInDb(clubId, "SUBMITTED");
      await request(app.getHttpServer())
        .patch(`/events/${event.id}/revision`)
        .set("Cookie", clubAdminCookie)
        .send({
          title: "Updated Title",
          description: "Updated Description",
          startsAt: "2026-08-10T14:00:00+03:00",
          endsAt: "2026-08-10T16:00:00+03:00",
          location: "AGU Amfi 2",
          capacity: 120
        })
        .expect(409);
    });

    it("updates revision and creates EVENT_REVISION_UPDATED audit log for club ADMIN", async () => {
      const event = await createDraftEventInDb(clubId, "CHANGES_REQUESTED");
      const res = await request(app.getHttpServer())
        .patch(`/events/${event.id}/revision`)
        .set("Cookie", clubAdminCookie)
        .send({
          title: "Revised Title",
          description: "Revised Description",
          startsAt: "2026-08-10T15:00:00+03:00",
          endsAt: "2026-08-10T17:00:00+03:00",
          location: "AGU Lab 1",
          capacity: 80
        })
        .expect(200);

      expect(res.body.title).toBe("Revised Title");
      expect(res.body.capacity).toBe(80);

      const updatedDb = await prisma.event.findUnique({ where: { id: event.id } });
      expect(updatedDb?.title).toBe("Revised Title");

      const audits = await prisma.auditLog.findMany({
        where: { entityType: "Event", entityId: event.id, action: "EVENT_REVISION_UPDATED" }
      });
      expect(audits).toHaveLength(1);
    });
  });

  describe("POST /events/:eventId/submit resubmission extension", () => {
    it("resubmits CHANGES_REQUESTED event to SUBMITTED and logs EVENT_RESUBMITTED audit", async () => {
      const event = await createDraftEventInDb(clubId, "CHANGES_REQUESTED");
      const res = await request(app.getHttpServer())
        .post(`/events/${event.id}/submit`)
        .set("Cookie", clubAdminCookie)
        .expect(200);

      expect(res.body.status).toBe("SUBMITTED");

      const dbEvent = await prisma.event.findUnique({ where: { id: event.id } });
      expect(dbEvent?.status).toBe("SUBMITTED");

      const audits = await prisma.auditLog.findMany({
        where: { entityType: "Event", entityId: event.id, action: "EVENT_RESUBMITTED" }
      });
      expect(audits).toHaveLength(1);
    });

    it("allows SYSTEM_ADMIN to resubmit a CHANGES_REQUESTED event", async () => {
      const event = await createDraftEventInDb(clubId, "CHANGES_REQUESTED");
      await request(app.getHttpServer())
        .post(`/events/${event.id}/submit`)
        .set("Cookie", systemAdminCookie)
        .expect(200);
    });

    it("returns 409 for invalid starting statuses", async () => {
      const invalidStatuses = ["SUBMITTED", "REJECTED", "APPROVED", "PUBLISHED", "CANCELLED", "COMPLETED"] as const;
      for (const status of invalidStatuses) {
        const event = await createDraftEventInDb(clubId, status);
        await request(app.getHttpServer())
          .post(`/events/${event.id}/submit`)
          .set("Cookie", clubAdminCookie)
          .expect(409);
      }
    });
  });

  async function createDraftEventInDb(
    clubIdParam: string,
    statusParam: import("@prisma/client").EventStatus = "DRAFT"
  ) {
    return prisma.event.create({
      data: {
        clubId: clubIdParam,
        createdById: clubAdminId,
        title: `Test Event ${Date.now()}`,
        slug: `test-event-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        description: "Test event description",
        startsAt: new Date("2026-08-10T14:00:00.000Z"),
        endsAt: new Date("2026-08-10T16:00:00.000Z"),
        location: "AGU Buyuk Amfi",
        status: statusParam
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

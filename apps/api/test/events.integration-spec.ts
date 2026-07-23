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
  let studentId: string;
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

    const pressLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "press.dev@agu.edu.tr" })
      .expect(201);
    pressCookie = getSessionCookie(pressLogin.headers["set-cookie"]);
    const pressEditor = await prisma.user.findUniqueOrThrow({
      where: { email: "press.dev@agu.edu.tr" }
    });
    pressEditorId = pressEditor.id;

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
            { slug: { startsWith: "integration-registration-event" } }
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

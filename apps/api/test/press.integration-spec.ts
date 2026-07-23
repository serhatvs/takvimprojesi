import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AUTH_SESSION_COOKIE_NAME } from "../src/auth/auth.constants";
import { loadRootEnv } from "../src/config/load-env";

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

describe("GET /press/events (Integration)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  let pressCookie: string;
  let systemAdminCookie: string;
  let studentCookie: string;
  let clubAdminCookie: string;
  let clubMemberCookie: string;

  const testClubId = "c8888888-8888-4888-8888-888888888888";

  async function cleanUp() {
    if (!prisma) return;
    await prisma.event.deleteMany({ where: { slug: { startsWith: "press-int-event" } } });
    await prisma.clubMembership.deleteMany({ where: { userId: { startsWith: "u-press-int-" } } });
    await prisma.userRole.deleteMany({ where: { userId: { startsWith: "u-press-int-" } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: "u-press-int-" } } });
    await prisma.club.deleteMany({ where: { id: testClubId } });
  }

  beforeAll(async () => {
    loadRootEnv();
    process.env.NODE_ENV = "test";
    process.env.ENABLE_DEV_AUTH = "true";
    process.env.AUTH_SESSION_SECRET = "integration-test-session-secret";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL must be defined for integration tests.");
    }

    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });

    await cleanUp();

    await prisma.club.create({
      data: {
        id: testClubId,
        name: "Press Test Music Club",
        slug: "press-test-music-club",
        isActive: true
      }
    });

    // Users
    await prisma.user.createMany({
      data: [
        { id: "u-press-int-press", email: "press-int-press@agu.edu.tr", displayName: "Press User" },
        { id: "u-press-int-sysadmin", email: "press-int-sysadmin@agu.edu.tr", displayName: "SysAdmin User" },
        { id: "u-press-int-student", email: "press-int-student@agu.edu.tr", displayName: "Student User" },
        { id: "u-press-int-clubadmin", email: "press-int-clubadmin@agu.edu.tr", displayName: "ClubAdmin User" },
        { id: "u-press-int-member", email: "press-int-member@agu.edu.tr", displayName: "Member User" }
      ]
    });

    await prisma.userRole.createMany({
      data: [
        { userId: "u-press-int-press", role: "PRESS_EDITOR" },
        { userId: "u-press-int-sysadmin", role: "SYSTEM_ADMIN" },
        { userId: "u-press-int-student", role: "STUDENT" },
        { userId: "u-press-int-clubadmin", role: "CLUB_ADMIN" },
        { userId: "u-press-int-member", role: "CLUB_MEMBER" }
      ]
    });

    await prisma.clubMembership.createMany({
      data: [
        { userId: "u-press-int-clubadmin", clubId: testClubId, role: "ADMIN", isActive: true },
        { userId: "u-press-int-member", clubId: testClubId, role: "MEMBER", isActive: true }
      ]
    });

    // Dev Login Cookies
    const pressLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "press-int-press@agu.edu.tr" });
    pressCookie = getSessionCookie(pressLogin.headers["set-cookie"]);

    const sysAdminLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "press-int-sysadmin@agu.edu.tr" });
    systemAdminCookie = getSessionCookie(sysAdminLogin.headers["set-cookie"]);

    const studentLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "press-int-student@agu.edu.tr" });
    studentCookie = getSessionCookie(studentLogin.headers["set-cookie"]);

    const clubAdminLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "press-int-clubadmin@agu.edu.tr" });
    clubAdminCookie = getSessionCookie(clubAdminLogin.headers["set-cookie"]);

    const memberLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "press-int-member@agu.edu.tr" });
    clubMemberCookie = getSessionCookie(memberLogin.headers["set-cookie"]);
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.event.deleteMany({ where: { slug: { startsWith: "press-int-event" } } });
  });

  it("1. returns 401 when unauthenticated", async () => {
    const res = await request(app.getHttpServer()).get("/press/events");
    expect(res.status).toBe(401);
  });

  it("2. returns 403 for STUDENT", async () => {
    const res = await request(app.getHttpServer())
      .get("/press/events")
      .set("Cookie", studentCookie);
    expect(res.status).toBe(403);
  });

  it("3. returns 403 for CLUB_MEMBER", async () => {
    const res = await request(app.getHttpServer())
      .get("/press/events")
      .set("Cookie", clubMemberCookie);
    expect(res.status).toBe(403);
  });

  it("4. returns 403 for CLUB_ADMIN-only user", async () => {
    const res = await request(app.getHttpServer())
      .get("/press/events")
      .set("Cookie", clubAdminCookie);
    expect(res.status).toBe(403);
  });

  it("5. returns 200 with PRESS_EDITOR and lists only SUBMITTED events", async () => {
    // Create draft and submitted events
    await prisma.event.create({
      data: {
        clubId: testClubId,
        createdById: "u-press-int-clubadmin",
        title: "Draft Event",
        slug: "press-int-event-draft",
        description: "Desc",
        startsAt: new Date("2026-09-01T10:00:00.000Z"),
        endsAt: new Date("2026-09-01T12:00:00.000Z"),
        location: "Hall 1",
        status: "DRAFT"
      }
    });

    await prisma.event.create({
      data: {
        clubId: testClubId,
        createdById: "u-press-int-clubadmin",
        title: "Submitted Music Event",
        slug: "press-int-event-submitted",
        description: "Concert description",
        startsAt: new Date("2026-09-02T10:00:00.000Z"),
        endsAt: new Date("2026-09-02T12:00:00.000Z"),
        location: "Hall 2",
        status: "SUBMITTED"
      }
    });

    const res = await request(app.getHttpServer())
      .get("/press/events?q=Submitted%20Music%20Event")
      .set("Cookie", pressCookie);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe("Submitted Music Event");
    expect(res.body.items[0].status).toBe("SUBMITTED");
    expect(res.body.items[0].club.name).toBe("Press Test Music Club");

    // Internal safety checks
    expect(res.body.items[0].createdById).toBeUndefined();
    expect(res.body.items[0].userId).toBeUndefined();
    expect(res.body.items[0].qrToken).toBeUndefined();
  });

  it("6. returns 200 with SYSTEM_ADMIN", async () => {
    const res = await request(app.getHttpServer())
      .get("/press/events")
      .set("Cookie", systemAdminCookie);

    expect(res.status).toBe(200);
  });

  it("7. searches case-insensitively in title, description, and club name", async () => {
    await prisma.event.create({
      data: {
        clubId: testClubId,
        createdById: "u-press-int-clubadmin",
        title: "Rock Festival",
        slug: "press-int-event-rock",
        description: "Live concert",
        startsAt: new Date("2026-09-03T10:00:00.000Z"),
        endsAt: new Date("2026-09-03T12:00:00.000Z"),
        location: "Stadium",
        status: "SUBMITTED"
      }
    });

    const resTitle = await request(app.getHttpServer())
      .get("/press/events?q=rock")
      .set("Cookie", pressCookie);
    expect(resTitle.body.items).toHaveLength(1);

    const resClub = await request(app.getHttpServer())
      .get("/press/events?q=Music")
      .set("Cookie", pressCookie);
    expect(resClub.body.items).toHaveLength(1);
  });

  it("8. validates page and pageSize query parameters", async () => {
    const resBadPage = await request(app.getHttpServer())
      .get("/press/events?page=-1")
      .set("Cookie", pressCookie);
    expect(resBadPage.status).toBe(400);

    const resBadSize = await request(app.getHttpServer())
      .get("/press/events?pageSize=101")
      .set("Cookie", pressCookie);
    expect(resBadSize.status).toBe(400);
  });
});

describe("GET /press/events/approved (Integration)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  let pressCookie: string;
  let systemAdminCookie: string;
  let studentCookie: string;
  let clubAdminCookie: string;
  let clubMemberCookie: string;

  const testClubId = "c9999999-9999-4999-9999-999999999999";

  async function cleanUp() {
    if (!prisma) return;
    await prisma.event.deleteMany({ where: { slug: { startsWith: "press-approved-int-event" } } });
    await prisma.clubMembership.deleteMany({ where: { userId: { startsWith: "u-press-approved-int-" } } });
    await prisma.userRole.deleteMany({ where: { userId: { startsWith: "u-press-approved-int-" } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: "u-press-approved-int-" } } });
    await prisma.club.deleteMany({ where: { id: testClubId } });
  }

  beforeAll(async () => {
    loadRootEnv();
    process.env.NODE_ENV = "test";
    process.env.ENABLE_DEV_AUTH = "true";
    process.env.AUTH_SESSION_SECRET = "integration-test-session-secret";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL must be defined for integration tests.");
    }

    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });

    await cleanUp();

    await prisma.club.create({
      data: {
        id: testClubId,
        name: "Press Approved Music Club",
        slug: "press-approved-music-club",
        isActive: true
      }
    });

    await prisma.user.createMany({
      data: [
        { id: "u-press-approved-int-press", email: "press-approved-int-press@agu.edu.tr", displayName: "Press User" },
        { id: "u-press-approved-int-sysadmin", email: "press-approved-int-sysadmin@agu.edu.tr", displayName: "SysAdmin User" },
        { id: "u-press-approved-int-student", email: "press-approved-int-student@agu.edu.tr", displayName: "Student User" },
        { id: "u-press-approved-int-clubadmin", email: "press-approved-int-clubadmin@agu.edu.tr", displayName: "ClubAdmin User" },
        { id: "u-press-approved-int-member", email: "press-approved-int-member@agu.edu.tr", displayName: "Member User" }
      ]
    });

    await prisma.userRole.createMany({
      data: [
        { userId: "u-press-approved-int-press", role: "PRESS_EDITOR" },
        { userId: "u-press-approved-int-sysadmin", role: "SYSTEM_ADMIN" },
        { userId: "u-press-approved-int-student", role: "STUDENT" },
        { userId: "u-press-approved-int-clubadmin", role: "CLUB_ADMIN" },
        { userId: "u-press-approved-int-member", role: "CLUB_MEMBER" }
      ]
    });

    await prisma.clubMembership.createMany({
      data: [
        { userId: "u-press-approved-int-clubadmin", clubId: testClubId, role: "ADMIN", isActive: true },
        { userId: "u-press-approved-int-member", clubId: testClubId, role: "MEMBER", isActive: true }
      ]
    });

    const pressLogin = await request(app.getHttpServer()).post("/auth/dev-login").send({ email: "press-approved-int-press@agu.edu.tr" });
    pressCookie = getSessionCookie(pressLogin.headers["set-cookie"]);

    const sysAdminLogin = await request(app.getHttpServer()).post("/auth/dev-login").send({ email: "press-approved-int-sysadmin@agu.edu.tr" });
    systemAdminCookie = getSessionCookie(sysAdminLogin.headers["set-cookie"]);

    const studentLogin = await request(app.getHttpServer()).post("/auth/dev-login").send({ email: "press-approved-int-student@agu.edu.tr" });
    studentCookie = getSessionCookie(studentLogin.headers["set-cookie"]);

    const clubAdminLogin = await request(app.getHttpServer()).post("/auth/dev-login").send({ email: "press-approved-int-clubadmin@agu.edu.tr" });
    clubAdminCookie = getSessionCookie(clubAdminLogin.headers["set-cookie"]);

    const memberLogin = await request(app.getHttpServer()).post("/auth/dev-login").send({ email: "press-approved-int-member@agu.edu.tr" });
    clubMemberCookie = getSessionCookie(memberLogin.headers["set-cookie"]);
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.event.deleteMany({ where: { slug: { startsWith: "press-approved-int-event" } } });
  });

  it("1. returns 401 when unauthenticated", async () => {
    const res = await request(app.getHttpServer()).get("/press/events/approved");
    expect(res.status).toBe(401);
  });

  it("2. returns 403 for STUDENT, CLUB_MEMBER, and CLUB_ADMIN-only", async () => {
    const resStud = await request(app.getHttpServer()).get("/press/events/approved").set("Cookie", studentCookie);
    expect(resStud.status).toBe(403);

    const resMem = await request(app.getHttpServer()).get("/press/events/approved").set("Cookie", clubMemberCookie);
    expect(resMem.status).toBe(403);

    const resAdmin = await request(app.getHttpServer()).get("/press/events/approved").set("Cookie", clubAdminCookie);
    expect(resAdmin.status).toBe(403);
  });

  it("3. returns 200 with PRESS_EDITOR and lists only APPROVED events", async () => {
    await prisma.event.create({
      data: {
        clubId: testClubId,
        createdById: "u-press-approved-int-clubadmin",
        title: "Submitted Event",
        slug: "press-approved-int-event-sub",
        description: "Desc",
        startsAt: new Date("2026-09-01T10:00:00.000Z"),
        endsAt: new Date("2026-09-01T12:00:00.000Z"),
        location: "Hall 1",
        status: "SUBMITTED"
      }
    });

    await prisma.event.create({
      data: {
        clubId: testClubId,
        createdById: "u-press-approved-int-clubadmin",
        title: "Approved Festival Event",
        slug: "press-approved-int-event-appr",
        description: "Fest description",
        startsAt: new Date("2026-09-02T10:00:00.000Z"),
        endsAt: new Date("2026-09-02T12:00:00.000Z"),
        location: "Hall 2",
        status: "APPROVED"
      }
    });

    const res = await request(app.getHttpServer())
      .get("/press/events/approved?q=Approved%20Festival")
      .set("Cookie", pressCookie);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe("Approved Festival Event");
    expect(res.body.items[0].status).toBe("APPROVED");
    expect(res.body.items[0].publishedAt).toBeNull();
    expect(res.body.items[0].club.name).toBe("Press Approved Music Club");

    // Internal safety checks
    expect(res.body.items[0].createdById).toBeUndefined();
    expect(res.body.items[0].userId).toBeUndefined();
    expect(res.body.items[0].qrToken).toBeUndefined();
  });

  it("4. returns 200 with SYSTEM_ADMIN", async () => {
    const res = await request(app.getHttpServer())
      .get("/press/events/approved")
      .set("Cookie", systemAdminCookie);

    expect(res.status).toBe(200);
  });

  it("5. validates page and pageSize query parameters", async () => {
    const resBadPage = await request(app.getHttpServer())
      .get("/press/events/approved?page=-1")
      .set("Cookie", pressCookie);
    expect(resBadPage.status).toBe(400);

    const resBadSize = await request(app.getHttpServer())
      .get("/press/events/approved?pageSize=101")
      .set("Cookie", pressCookie);
    expect(resBadSize.status).toBe(400);
  });
});

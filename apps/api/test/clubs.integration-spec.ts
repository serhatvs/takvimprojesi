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

describe("Clubs endpoints (Integration)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  let adminCookie: string;
  let inactiveAdminCookie: string;
  let memberCookie: string;
  let studentCookie: string;
  let pressCookie: string;
  let systemAdminCookie: string;
  let multiRoleCookie: string;

  const testClub1Id = "c1111111-1111-4111-8111-111111111111";
  const testClub2Id = "c2222222-2222-4222-8222-222222222222";
  const unknownClubId = "c3333333-3333-4333-8333-333333333333";
  
  async function cleanUp() {
    if (!prisma) return;
    await prisma.event.deleteMany({ where: { slug: { startsWith: "int-test-event" } } });
    await prisma.clubMembership.deleteMany({ where: { userId: { startsWith: "u-int-" } } });
    await prisma.userRole.deleteMany({ where: { userId: { startsWith: "u-int-" } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: "u-int-" } } });
    await prisma.club.deleteMany({ where: { id: { in: [testClub1Id, testClub2Id] } } });
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
    
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
    });

    await cleanUp();

    await prisma.club.createMany({
      data: [
        { id: testClub1Id, name: "Int Test Club A", slug: "int-test-club-a" },
        { id: testClub2Id, name: "Int Test Club B", slug: "int-test-club-b" },
      ]
    });

    const users = [
      { id: "u-int-admin", email: "int-admin@agu.edu.tr", displayName: "Int Admin" },
      { id: "u-int-inactive-admin", email: "int-inactive-admin@agu.edu.tr", displayName: "Int Inactive" },
      { id: "u-int-member", email: "int-member@agu.edu.tr", displayName: "Int Member" },
      { id: "u-int-student", email: "int-student@agu.edu.tr", displayName: "Int Student" },
      { id: "u-int-press", email: "int-press@agu.edu.tr", displayName: "Int Press" },
      { id: "u-int-sysadmin", email: "int-sysadmin@agu.edu.tr", displayName: "Int SysAdmin" },
      { id: "u-int-multirole", email: "int-multirole@agu.edu.tr", displayName: "Int Multi" },
    ];
    await prisma.user.createMany({ data: users });

    const userRoles = [
      { userId: "u-int-admin", role: "STUDENT" },
      { userId: "u-int-inactive-admin", role: "STUDENT" },
      { userId: "u-int-member", role: "STUDENT" },
      { userId: "u-int-student", role: "STUDENT" },
      { userId: "u-int-press", role: "PRESS_EDITOR" },
      { userId: "u-int-sysadmin", role: "SYSTEM_ADMIN" },
      { userId: "u-int-multirole", role: "STUDENT" },
    ];
    for (const r of userRoles) {
      await prisma.userRole.create({ data: { userId: r.userId, role: r.role as RoleName } });
    }

    await prisma.clubMembership.createMany({
      data: [
        { userId: "u-int-admin", clubId: testClub1Id, role: "ADMIN", isActive: true },
        { userId: "u-int-inactive-admin", clubId: testClub1Id, role: "ADMIN", isActive: false },
        { userId: "u-int-member", clubId: testClub1Id, role: "MEMBER", isActive: true },
        { userId: "u-int-multirole", clubId: testClub1Id, role: "ADMIN", isActive: true },
        { userId: "u-int-multirole", clubId: testClub2Id, role: "ADMIN", isActive: true },
      ]
    });

    const eventDates = {
        past: new Date(Date.now() - 86400000),
        future: new Date(Date.now() + 86400000)
    };
    await prisma.event.createMany({
      data: [
        { id: "e-int-1", clubId: testClub1Id, title: "Z Test Event Draft", slug: "int-test-event-draft", description: "Desc", location: "L", capacity: 10, status: "DRAFT", startsAt: eventDates.future, endsAt: eventDates.future, createdById: "u-int-admin", updatedAt: new Date("2026-01-01T10:00:00Z") },
        { id: "e-int-2", clubId: testClub1Id, title: "A Test Event Published", slug: "int-test-event-published", description: "Another text query desc", location: "L", capacity: null, status: "PUBLISHED", startsAt: eventDates.past, endsAt: eventDates.future, createdById: "u-int-admin", publishedAt: new Date(), updatedAt: new Date("2026-01-02T10:00:00Z") },
        { id: "e-int-3", clubId: testClub1Id, title: "Query target", slug: "int-test-event-query", description: "Desc", location: "L", capacity: null, status: "SUBMITTED", startsAt: eventDates.future, endsAt: eventDates.future, createdById: "u-int-admin", updatedAt: new Date("2026-01-01T11:00:00Z") },
      ]
    });

    adminCookie = getSessionCookie((await request(app.getHttpServer()).post("/auth/dev-login").send({ email: "int-admin@agu.edu.tr" })).headers["set-cookie"]);
    inactiveAdminCookie = getSessionCookie((await request(app.getHttpServer()).post("/auth/dev-login").send({ email: "int-inactive-admin@agu.edu.tr" })).headers["set-cookie"]);
    memberCookie = getSessionCookie((await request(app.getHttpServer()).post("/auth/dev-login").send({ email: "int-member@agu.edu.tr" })).headers["set-cookie"]);
    studentCookie = getSessionCookie((await request(app.getHttpServer()).post("/auth/dev-login").send({ email: "int-student@agu.edu.tr" })).headers["set-cookie"]);
    pressCookie = getSessionCookie((await request(app.getHttpServer()).post("/auth/dev-login").send({ email: "int-press@agu.edu.tr" })).headers["set-cookie"]);
    systemAdminCookie = getSessionCookie((await request(app.getHttpServer()).post("/auth/dev-login").send({ email: "int-sysadmin@agu.edu.tr" })).headers["set-cookie"]);
    multiRoleCookie = getSessionCookie((await request(app.getHttpServer()).post("/auth/dev-login").send({ email: "int-multirole@agu.edu.tr" })).headers["set-cookie"]);
  });

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.ENABLE_DEV_AUTH = "true";
    process.env.AUTH_SESSION_SECRET = "integration-test-session-secret";
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
    process.env = { ...originalEnv };
  });

  describe("GET /clubs/manageable", () => {
    it("returns 401 without authentication", async () => {
      await request(app.getHttpServer()).get("/clubs/manageable").expect(401);
    });

    it("returns active ADMIN clubs for club admin", async () => {
        const res = await request(app.getHttpServer())
          .get("/clubs/manageable")
          .set("Cookie", adminCookie)
          .expect(200);
        
        expect(res.body.clubs).toHaveLength(1);
        expect(res.body.clubs[0].id).toBe(testClub1Id);
        expect(res.body.clubs[0].name).toBe("Int Test Club A");
        
        expect(res.body.clubs[0].email).toBeUndefined();
        expect(res.body.clubs[0].memberships).toBeUndefined();
    });

    it("does not return clubs for inactive ADMIN", async () => {
        const res = await request(app.getHttpServer())
          .get("/clubs/manageable")
          .set("Cookie", inactiveAdminCookie)
          .expect(200);
        expect(res.body.clubs).toHaveLength(0);
    });

    it("does not return clubs for CLUB_MEMBER", async () => {
        const res = await request(app.getHttpServer())
          .get("/clubs/manageable")
          .set("Cookie", memberCookie)
          .expect(200);
        expect(res.body.clubs).toHaveLength(0);
    });

    it("returns empty items for STUDENT-only user", async () => {
        const res = await request(app.getHttpServer())
          .get("/clubs/manageable")
          .set("Cookie", studentCookie)
          .expect(200);
        expect(res.body.clubs).toHaveLength(0);
    });

    it("returns empty items for PRESS_EDITOR-only user", async () => {
        const res = await request(app.getHttpServer())
          .get("/clubs/manageable")
          .set("Cookie", pressCookie)
          .expect(200);
        expect(res.body.clubs).toHaveLength(0);
    });

    it("returns active ADMIN clubs for user with multiple roles", async () => {
        const res = await request(app.getHttpServer())
          .get("/clubs/manageable")
          .set("Cookie", multiRoleCookie)
          .expect(200);
        expect(res.body.clubs).toHaveLength(2);
        
        expect(res.body.clubs[0].name).toBe("Int Test Club A");
        expect(res.body.clubs[1].name).toBe("Int Test Club B");
    });

    it("returns all clubs for SYSTEM_ADMIN", async () => {
        const res = await request(app.getHttpServer())
          .get("/clubs/manageable")
          .set("Cookie", systemAdminCookie)
          .expect(200);
        
        const clubIds = res.body.clubs.map((c: { id: string }) => c.id);
        expect(clubIds).toContain(testClub1Id);
        expect(clubIds).toContain(testClub2Id);
        
        const names = res.body.clubs.map((c: { name: string }) => c.name);
        const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
        expect(names).toEqual(sortedNames);
    });
  });

  describe("GET /clubs/:clubId/events", () => {
    it("returns 401 without authentication", async () => {
      await request(app.getHttpServer()).get(`/clubs/${testClub1Id}/events`).expect(401);
    });

    it("returns 200 for active ADMIN of the club", async () => {
      const res = await request(app.getHttpServer())
        .get(`/clubs/${testClub1Id}/events`)
        .set("Cookie", adminCookie)
        .expect(200);
      
      expect(res.body.club.id).toBe(testClub1Id);
      expect(res.body.items).toHaveLength(3);
      
      const firstItem = res.body.items[0];
      expect(firstItem.createdById).toBeUndefined();
      expect(firstItem.auditLogs).toBeUndefined();
      expect(firstItem.memberships).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain("int-admin@agu.edu.tr");
      expect(JSON.stringify(res.body)).not.toContain("hash");
    });

    it("returns 403 for active ADMIN of another club", async () => {
      await request(app.getHttpServer())
        .get(`/clubs/${testClub2Id}/events`)
        .set("Cookie", adminCookie)
        .expect(403);
    });

    it("returns 403 for CLUB_MEMBER", async () => {
      await request(app.getHttpServer())
        .get(`/clubs/${testClub1Id}/events`)
        .set("Cookie", memberCookie)
        .expect(403);
    });

    it("returns 403 for STUDENT", async () => {
      await request(app.getHttpServer())
        .get(`/clubs/${testClub1Id}/events`)
        .set("Cookie", studentCookie)
        .expect(403);
    });

    it("returns 403 for PRESS_EDITOR", async () => {
      await request(app.getHttpServer())
        .get(`/clubs/${testClub1Id}/events`)
        .set("Cookie", pressCookie)
        .expect(403);
    });

    it("returns 200 for SYSTEM_ADMIN", async () => {
      await request(app.getHttpServer())
        .get(`/clubs/${testClub1Id}/events`)
        .set("Cookie", systemAdminCookie)
        .expect(200);
    });

    it("returns 404 for unknown club", async () => {
      await request(app.getHttpServer())
        .get(`/clubs/${unknownClubId}/events`)
        .set("Cookie", systemAdminCookie)
        .expect(404);
    });

    it("returns 400 for invalid clubId", async () => {
      await request(app.getHttpServer())
        .get(`/clubs/invalid-id-format/events`)
        .set("Cookie", adminCookie)
        .expect(400);
    });

    it("returns 400 for invalid status", async () => {
        await request(app.getHttpServer())
          .get(`/clubs/${testClub1Id}/events?status=INVALID_STATUS`)
          .set("Cookie", adminCookie)
          .expect(400);
    });

    it("returns 400 for invalid page or pageSize", async () => {
        await request(app.getHttpServer())
          .get(`/clubs/${testClub1Id}/events?page=-1`)
          .set("Cookie", adminCookie)
          .expect(400);
        await request(app.getHttpServer())
          .get(`/clubs/${testClub1Id}/events?pageSize=abc`)
          .set("Cookie", adminCookie)
          .expect(400);
    });

    it("status filter works correctly", async () => {
      const res = await request(app.getHttpServer())
        .get(`/clubs/${testClub1Id}/events?status=PUBLISHED`)
        .set("Cookie", adminCookie)
        .expect(200);
      
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].status).toBe("PUBLISHED");
      expect(res.body.items[0].id).toBe("e-int-2");
    });

    it("q param works on title case-insensitive", async () => {
      const res = await request(app.getHttpServer())
        .get(`/clubs/${testClub1Id}/events?q=TARGET`)
        .set("Cookie", adminCookie)
        .expect(200);
      
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe("Query target");
    });

    it("q param works on description case-insensitive", async () => {
      const res = await request(app.getHttpServer())
        .get(`/clubs/${testClub1Id}/events?q=TEXT%20QUERY`)
        .set("Cookie", adminCookie)
        .expect(200);
      
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].description).toBe("Another text query desc");
    });

    it("pagination metadata calculated correctly", async () => {
      const res = await request(app.getHttpServer())
        .get(`/clubs/${testClub1Id}/events?page=1&pageSize=2`)
        .set("Cookie", adminCookie)
        .expect(200);
      
      expect(res.body.items).toHaveLength(2);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        pageSize: 2,
        totalItems: 3,
        totalPages: 2
      });
    });

    it("items sorted by updatedAt DESC, then id ASC", async () => {
      const res = await request(app.getHttpServer())
        .get(`/clubs/${testClub1Id}/events`)
        .set("Cookie", adminCookie)
        .expect(200);
      
      expect(res.body.items[0].id).toBe("e-int-2");
      expect(res.body.items[1].id).toBe("e-int-3");
      expect(res.body.items[2].id).toBe("e-int-1");
    });

    it("totalItems respects active q and status filters", async () => {
      const res = await request(app.getHttpServer())
        .get(`/clubs/${testClub1Id}/events?q=Test&status=DRAFT`)
        .set("Cookie", adminCookie)
        .expect(200);
      
      expect(res.body.pagination.totalItems).toBe(1);
    });

    it("statusCounts is unaffected by q and status filters", async () => {
      const res = await request(app.getHttpServer())
        .get(`/clubs/${testClub1Id}/events?q=Test&status=DRAFT`)
        .set("Cookie", adminCookie)
        .expect(200);
      
      expect(res.body.statusCounts).toMatchObject({
        DRAFT: 1,
        SUBMITTED: 1,
        CHANGES_REQUESTED: 0,
        REJECTED: 0,
        APPROVED: 0,
        PUBLISHED: 1,
        CANCELLED: 0,
        COMPLETED: 0,
      });
    });

    it("statusCounts contains all event statuses", async () => {
      const res = await request(app.getHttpServer())
        .get(`/clubs/${testClub1Id}/events`)
        .set("Cookie", adminCookie)
        .expect(200);
      
      expect(Object.keys(res.body.statusCounts).sort()).toEqual([
        "APPROVED", "CANCELLED", "CHANGES_REQUESTED", "COMPLETED", "DRAFT", "PUBLISHED", "REJECTED", "SUBMITTED"
      ]);
    });
  });
});

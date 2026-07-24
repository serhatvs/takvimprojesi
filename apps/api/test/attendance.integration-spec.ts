import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Attendance integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clubAdminCookie: string;
  let otherClubAdminCookie: string;
  let studentCookie: string;
  let unregisteredStudentCookie: string;

  let clubAdminId: string;
  let otherClubAdminId: string;
  let studentId: string;
  let unregisteredStudentId: string;
  let clubId: string;
  let otherClubId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const clubAdminUser = await prisma.user.findUniqueOrThrow({
      where: { email: "club.admin.dev@agu.edu.tr" }
    });
    clubAdminId = clubAdminUser.id;

    const studentUser = await prisma.user.findUniqueOrThrow({
      where: { email: "student.dev@agu.edu.tr" }
    });
    studentId = studentUser.id;

    const clubAdminLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "club.admin.dev@agu.edu.tr" })
      .expect(201);
    clubAdminCookie = clubAdminLogin.get("Set-Cookie")?.[0] ?? "";

    const studentLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: "student.dev@agu.edu.tr" })
      .expect(201);
    studentCookie = studentLogin.get("Set-Cookie")?.[0] ?? "";

    // Create an auxiliary club and other club admin
    const otherUser = await prisma.user.create({
      data: {
        email: `other-admin-${Date.now()}@agu.edu.tr`,
        displayName: "Other Admin"
      }
    });
    otherClubAdminId = otherUser.id;

    await prisma.userRole.create({
      data: {
        userId: otherClubAdminId,
        role: "CLUB_ADMIN"
      }
    });

    const otherClub = await prisma.club.create({
      data: {
        name: `Other Club ${Date.now()}`,
        slug: `other-club-${Date.now()}`
      }
    });
    otherClubId = otherClub.id;

    await prisma.clubMembership.create({
      data: {
        clubId: otherClubId,
        userId: otherClubAdminId,
        role: "ADMIN",
        isActive: true
      }
    });

    const otherLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: otherUser.email })
      .expect(201);
    otherClubAdminCookie = otherLogin.get("Set-Cookie")?.[0] ?? "";

    // Unregistered student
    const unregisteredUser = await prisma.user.create({
      data: {
        email: `unregistered-student-${Date.now()}@agu.edu.tr`,
        displayName: "Unregistered Student"
      }
    });
    unregisteredStudentId = unregisteredUser.id;
    await prisma.userRole.create({
      data: {
        userId: unregisteredStudentId,
        role: "STUDENT"
      }
    });
    const unregLogin = await request(app.getHttpServer())
      .post("/auth/dev-login")
      .send({ email: unregisteredUser.email })
      .expect(201);
    unregisteredStudentCookie = unregLogin.get("Set-Cookie")?.[0] ?? "";

    const club = await prisma.club.findFirstOrThrow();
    clubId = club.id;
  });

  afterAll(async () => {
    // Cleanup dynamic test records only (do NOT delete seed users studentId/clubAdminId)
    const dynamicUserIds = [unregisteredStudentId, otherClubAdminId].filter(Boolean);
    await prisma.attendance.deleteMany({ where: { userId: { in: [studentId, unregisteredStudentId].filter(Boolean) } } });
    await prisma.eventRegistration.deleteMany({ where: { userId: { in: [studentId, unregisteredStudentId].filter(Boolean) } } });
    await prisma.event.deleteMany({ where: { slug: { startsWith: "integration-att-" } } });
    await prisma.clubMembership.deleteMany({ where: { userId: { in: dynamicUserIds } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: dynamicUserIds } } });
    if (otherClubId) {
      await prisma.club.deleteMany({ where: { id: otherClubId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: dynamicUserIds } } });
    await app.close();
  });

  async function createTestEvent(slug: string, options: { status?: string; startsAt?: Date; endsAt?: Date } = {}) {
    return prisma.event.create({
      data: {
        clubId,
        createdById: clubAdminId,
        title: `Test Event ${slug}`,
        slug,
        description: "Test description",
        location: "AGU Hall",
        status: (options.status as import("@prisma/client").EventStatus) ?? "PUBLISHED",
        startsAt: options.startsAt ?? new Date(Date.now() - 10 * 60 * 1000), // started 10m ago
        endsAt: options.endsAt ?? new Date(Date.now() + 50 * 60 * 1000)      // ends in 50m
      }
    });
  }

  describe("POST /events/:eventId/attendance-token", () => {
    it("returns 401 unauthenticated", async () => {
      const event = await createTestEvent("integration-att-token-unauth");
      await request(app.getHttpServer())
        .post(`/events/${event.id}/attendance-token`)
        .expect(401);
    });

    it("allows authorized club admin to issue attendance token", async () => {
      const event = await createTestEvent("integration-att-token-admin");
      const res = await request(app.getHttpServer())
        .post(`/events/${event.id}/attendance-token`)
        .set("Cookie", clubAdminCookie)
        .expect(200);

      expect(res.body.eventId).toBe(event.id);
      expect(typeof res.body.token).toBe("string");
      expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("returns 403 for admin of another club", async () => {
      const event = await createTestEvent("integration-att-token-other-admin");
      await request(app.getHttpServer())
        .post(`/events/${event.id}/attendance-token`)
        .set("Cookie", otherClubAdminCookie)
        .expect(403);
    });

    it("returns 403 for student attempting to issue token", async () => {
      const event = await createTestEvent("integration-att-token-student");
      await request(app.getHttpServer())
        .post(`/events/${event.id}/attendance-token`)
        .set("Cookie", studentCookie)
        .expect(403);
    });
  });

  describe("POST /attendance/check-in", () => {
    it("returns 401 unauthenticated", async () => {
      await request(app.getHttpServer())
        .post("/attendance/check-in")
        .send({ token: "some-token" })
        .expect(401);
    });

    it("allows registered student with valid token to check in and records Attendance", async () => {
      const event = await createTestEvent("integration-att-checkin-success");
      await prisma.eventRegistration.create({
        data: { eventId: event.id, userId: studentId }
      });

      const tokenRes = await request(app.getHttpServer())
        .post(`/events/${event.id}/attendance-token`)
        .set("Cookie", clubAdminCookie)
        .expect(200);

      const checkInRes = await request(app.getHttpServer())
        .post("/attendance/check-in")
        .set("Cookie", studentCookie)
        .send({ token: tokenRes.body.token })
        .expect(201);

      expect(checkInRes.body.eventId).toBe(event.id);
      expect(checkInRes.body.userId).toBe(studentId);

      const attendanceInDb = await prisma.attendance.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: studentId } }
      });
      expect(attendanceInDb).not.toBeNull();
      expect(attendanceInDb?.source).toBe("QR");

      // Verify audit log entry exists and does NOT leak token
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: event.id, action: "EVENT_ATTENDANCE_RECORDED" }
      });
      expect(audit).not.toBeNull();
      expect(JSON.stringify(audit?.metadata)).not.toContain(tokenRes.body.token);
    });

    it("returns 409 for second check-in attempt by same student", async () => {
      const event = await createTestEvent("integration-att-checkin-duplicate");
      await prisma.eventRegistration.create({
        data: { eventId: event.id, userId: studentId }
      });

      const tokenRes = await request(app.getHttpServer())
        .post(`/events/${event.id}/attendance-token`)
        .set("Cookie", clubAdminCookie)
        .expect(200);

      await request(app.getHttpServer())
        .post("/attendance/check-in")
        .set("Cookie", studentCookie)
        .send({ token: tokenRes.body.token })
        .expect(201);

      // Second check-in
      await request(app.getHttpServer())
        .post("/attendance/check-in")
        .set("Cookie", studentCookie)
        .send({ token: tokenRes.body.token })
        .expect(409);
    });

    it("returns 409 for unregistered student", async () => {
      const event = await createTestEvent("integration-att-checkin-unregistered");

      const tokenRes = await request(app.getHttpServer())
        .post(`/events/${event.id}/attendance-token`)
        .set("Cookie", clubAdminCookie)
        .expect(200);

      await request(app.getHttpServer())
        .post("/attendance/check-in")
        .set("Cookie", unregisteredStudentCookie)
        .send({ token: tokenRes.body.token })
        .expect(409);
    });

    it("returns 400 for tampered token", async () => {
      const event = await createTestEvent("integration-att-checkin-tampered");
      await prisma.eventRegistration.create({
        data: { eventId: event.id, userId: studentId }
      });

      const tokenRes = await request(app.getHttpServer())
        .post(`/events/${event.id}/attendance-token`)
        .set("Cookie", clubAdminCookie)
        .expect(200);

      const tampered = tokenRes.body.token + "tampered";
      await request(app.getHttpServer())
        .post("/attendance/check-in")
        .set("Cookie", studentCookie)
        .send({ token: tampered })
        .expect(400);
    });

    it("allows only single successful record during concurrent check-in requests", async () => {
      const event = await createTestEvent("integration-att-checkin-concurrent");
      await prisma.eventRegistration.create({
        data: { eventId: event.id, userId: studentId }
      });

      const tokenRes = await request(app.getHttpServer())
        .post(`/events/${event.id}/attendance-token`)
        .set("Cookie", clubAdminCookie)
        .expect(200);

      const responses = await Promise.all([
        request(app.getHttpServer())
          .post("/attendance/check-in")
          .set("Cookie", studentCookie)
          .send({ token: tokenRes.body.token }),
        request(app.getHttpServer())
          .post("/attendance/check-in")
          .set("Cookie", studentCookie)
          .send({ token: tokenRes.body.token })
      ]);

      const statuses = responses.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409]);

      const count = await prisma.attendance.count({
        where: { eventId: event.id, userId: studentId }
      });
      expect(count).toBe(1);
    });
  });
});

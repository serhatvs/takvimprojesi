import { BadRequestException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  compareOtpHashes,
  computeOtpHash,
  EmailOtpService,
  generateOtpCode,
  isAguEmailDomain,
  isValidEmailFormat,
  normalizeEmail
} from "./email-otp.service";

type MockFn = ReturnType<typeof vi.fn>;
type MockPrisma = {
  emailLoginChallenge: {
    findFirst: MockFn;
    create: MockFn;
    update: MockFn;
    updateMany: MockFn;
  };
  user: {
    findUnique: MockFn;
    create: MockFn;
    findUniqueOrThrow: MockFn;
  };
  userRole: {
    create: MockFn;
  };
  auditLog: {
    create: MockFn;
  };
  $transaction: MockFn;
};

type MockDelivery = {
  sendOtp: MockFn;
};

type MockSession = {
  createSessionToken: MockFn;
};

describe("EmailOtpService & Helpers", () => {
  describe("normalizeEmail & isValidEmailFormat & isAguEmailDomain", () => {
    it("normalizes email to lowercase and trimmed string", () => {
      expect(normalizeEmail("  USER@AGU.EDU.TR  ")).toBe("user@agu.edu.tr");
    });

    it("validates email formats", () => {
      expect(isValidEmailFormat("student@agu.edu.tr")).toBe(true);
      expect(isValidEmailFormat("external@gmail.com")).toBe(true);
      expect(isValidEmailFormat("invalid-email")).toBe(false);
      expect(isValidEmailFormat("")).toBe(false);
    });

    it("checks AGÜ domain strictly", () => {
      expect(isAguEmailDomain("student@agu.edu.tr")).toBe(true);
      expect(isAguEmailDomain("STUDENT@AGU.EDU.TR")).toBe(true);
      expect(isAguEmailDomain("user@fakeagu.edu.tr")).toBe(false);
      expect(isAguEmailDomain("user@agu.edu.tr.attacker.com")).toBe(false);
      expect(isAguEmailDomain("user@gmail.com")).toBe(false);
    });
  });

  describe("generateOtpCode & computeOtpHash & compareOtpHashes", () => {
    it("generates 6-digit numeric string", () => {
      for (let i = 0; i < 50; i++) {
        const code = generateOtpCode();
        expect(code).toMatch(/^\d{6}$/);
      }
    });

    it("computes and compares OTP hashes safely", () => {
      const email = "test@agu.edu.tr";
      const code = "123456";
      const hash = computeOtpHash(email, code);

      expect(hash).toHaveLength(64); // SHA256 hex length
      expect(compareOtpHashes(hash, computeOtpHash(email, code))).toBe(true);
      expect(compareOtpHashes(hash, computeOtpHash(email, "654321"))).toBe(false);
    });
  });

  describe("EmailOtpService logic", () => {
    let service: EmailOtpService;
    let mockPrisma: MockPrisma;
    let mockDelivery: MockDelivery;
    let mockSession: MockSession;

    beforeEach(() => {
      mockPrisma = {
        emailLoginChallenge: {
          findFirst: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn()
        },
        user: {
          findUnique: vi.fn(),
          create: vi.fn(),
          findUniqueOrThrow: vi.fn()
        },
        userRole: {
          create: vi.fn()
        },
        auditLog: {
          create: vi.fn()
        },
        $transaction: vi.fn((cb) => cb(mockPrisma))
      };

      mockDelivery = {
        sendOtp: vi.fn().mockResolvedValue(undefined)
      };

      mockSession = {
        createSessionToken: vi.fn().mockResolvedValue("mock-jwt-token")
      };

      service = new EmailOtpService(
        mockPrisma as unknown as import("../../prisma/prisma.service").PrismaService,
        mockDelivery as unknown as import("./email-delivery.service").EmailDeliveryService,
        mockSession as unknown as import("../auth-session.service").AuthSessionService
      );
    });

    it("requestCode creates new challenge and sends email", async () => {
      mockPrisma.emailLoginChallenge.findFirst.mockResolvedValue(null);
      mockPrisma.emailLoginChallenge.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.emailLoginChallenge.create.mockResolvedValue({ id: "ch-1" });

      const result = await service.requestCode("student@agu.edu.tr");

      expect(result).toEqual({
        message: "Kod gönderilebildiyse e-posta adresinize ulaştırıldı."
      });
      expect(mockDelivery.sendOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "student@agu.edu.tr",
          expiresInMinutes: 10
        })
      );
    });

    it("requestCode respects cooldown and returns same message without sending email", async () => {
      const now = new Date();
      mockPrisma.emailLoginChallenge.findFirst.mockResolvedValue({
        id: "ch-active",
        email: "student@agu.edu.tr",
        lastSentAt: new Date(now.getTime() - 30 * 1000) // sent 30 seconds ago (< 60s)
      });

      const result = await service.requestCode("student@agu.edu.tr");

      expect(result).toEqual({
        message: "Kod gönderilebildiyse e-posta adresinize ulaştırıldı."
      });
      expect(mockDelivery.sendOtp).not.toHaveBeenCalled();
    });

    it("verifyCode rejects invalid or expired code", async () => {
      mockPrisma.emailLoginChallenge.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyCode("student@agu.edu.tr", "123456")
      ).rejects.toThrow(BadRequestException);
    });

    it("verifyCode rejects code when failedAttempts >= 5", async () => {
      mockPrisma.emailLoginChallenge.findFirst.mockResolvedValue({
        id: "ch-1",
        email: "student@agu.edu.tr",
        expiresAt: new Date(Date.now() + 600000),
        failedAttempts: 5,
        otpHash: computeOtpHash("student@agu.edu.tr", "123456")
      });

      await expect(
        service.verifyCode("student@agu.edu.tr", "123456")
      ).rejects.toThrow(BadRequestException);
    });

    it("verifyCode increments failedAttempts on wrong code", async () => {
      mockPrisma.emailLoginChallenge.findFirst.mockResolvedValue({
        id: "ch-1",
        email: "student@agu.edu.tr",
        expiresAt: new Date(Date.now() + 600000),
        failedAttempts: 0,
        otpHash: computeOtpHash("student@agu.edu.tr", "123456")
      });

      await expect(
        service.verifyCode("student@agu.edu.tr", "999999")
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.emailLoginChallenge.update).toHaveBeenCalledWith({
        where: { id: "ch-1" },
        data: { failedAttempts: { increment: 1 } }
      });
    });

    it("verifyCode creates new AGÜ user with STUDENT role", async () => {
      const code = "123456";
      const hash = computeOtpHash("newstudent@agu.edu.tr", code);

      mockPrisma.emailLoginChallenge.findFirst.mockResolvedValue({
        id: "ch-1",
        email: "newstudent@agu.edu.tr",
        expiresAt: new Date(Date.now() + 600000),
        failedAttempts: 0,
        otpHash: hash
      });

      mockPrisma.emailLoginChallenge.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "usr-1",
        email: "newstudent@agu.edu.tr",
        displayName: "New Student",
        roles: [{ role: RoleName.STUDENT }]
      });

      const res = await service.verifyCode("newstudent@agu.edu.tr", code, "New Student");

      expect(res.user).toEqual({
        id: "usr-1",
        email: "newstudent@agu.edu.tr",
        displayName: "New Student",
        roles: [RoleName.STUDENT]
      });
      expect(res.token).toBe("mock-jwt-token");
    });

    it("verifyCode creates new external user with EXTERNAL_PARTICIPANT role", async () => {
      const code = "123456";
      const hash = computeOtpHash("guest@gmail.com", code);

      mockPrisma.emailLoginChallenge.findFirst.mockResolvedValue({
        id: "ch-2",
        email: "guest@gmail.com",
        expiresAt: new Date(Date.now() + 600000),
        failedAttempts: 0,
        otpHash: hash
      });

      mockPrisma.emailLoginChallenge.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "usr-2",
        email: "guest@gmail.com",
        displayName: "Guest User",
        roles: [{ role: RoleName.EXTERNAL_PARTICIPANT }]
      });

      const res = await service.verifyCode("guest@gmail.com", code, "Guest User");

      expect(res.user.roles).toEqual([RoleName.EXTERNAL_PARTICIPANT]);
    });

    it("verifyCode preserves existing user roles and does not grant privileged roles automatically", async () => {
      const code = "123456";
      const hash = computeOtpHash("admin.dev@agu.edu.tr", code);

      mockPrisma.emailLoginChallenge.findFirst.mockResolvedValue({
        id: "ch-3",
        email: "admin.dev@agu.edu.tr",
        expiresAt: new Date(Date.now() + 600000),
        failedAttempts: 0,
        otpHash: hash
      });

      mockPrisma.emailLoginChallenge.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-admin",
        email: "admin.dev@agu.edu.tr",
        displayName: "System Admin",
        roles: [
          { role: RoleName.STUDENT },
          { role: RoleName.CLUB_ADMIN },
          { role: RoleName.SYSTEM_ADMIN }
        ]
      });

      const res = await service.verifyCode("admin.dev@agu.edu.tr", code);

      expect(res.user.roles).toEqual([
        RoleName.STUDENT,
        RoleName.CLUB_ADMIN,
        RoleName.SYSTEM_ADMIN
      ]);
    });
  });
});

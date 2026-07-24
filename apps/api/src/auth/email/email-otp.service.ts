import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import { RoleName } from "@prisma/client";
import * as crypto from "crypto";
import {
  EMAIL_OTP_MAX_FAILED_ATTEMPTS,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  EMAIL_OTP_TTL_MINUTES,
  getEmailOtpSecret
} from "@agu/config";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthSessionService } from "../auth-session.service";
import { EmailDeliveryService } from "./email-delivery.service";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }
  const normalized = normalizeEmail(email);
  // Basic RFC 5322 compatible regex check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(normalized);
}

export function isAguEmailDomain(email: string): boolean {
  const normalized = normalizeEmail(email);
  const parts = normalized.split("@");
  if (parts.length !== 2) {
    return false;
  }
  return parts[1] === "agu.edu.tr";
}

export function generateOtpCode(): string {
  const num = crypto.randomInt(0, 1000000);
  return num.toString().padStart(6, "0");
}

export function computeOtpHash(email: string, code: string): string {
  const secret = getEmailOtpSecret();
  return crypto
    .createHmac("sha256", secret)
    .update(`${normalizeEmail(email)}:${code}`)
    .digest("hex");
}

export function compareOtpHashes(hashA: string, hashB: string): boolean {
  const bufA = Buffer.from(hashA, "hex");
  const bufB = Buffer.from(hashB, "hex");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isEmailAuthEnabled(): boolean {
  const enabled = process.env.ENABLE_EMAIL_AUTH;
  if (process.env.NODE_ENV === "production") {
    return enabled === "true";
  }
  return enabled !== "false";
}

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailDeliveryService: EmailDeliveryService,
    private readonly authSessionService: AuthSessionService
  ) {}

  async requestCode(emailInput: unknown): Promise<{ message: string }> {
    if (!isEmailAuthEnabled()) {
      throw new ServiceUnavailableException("E-posta ile giriş sistemi devredışıdır.");
    }

    if (typeof emailInput !== "string" || !isValidEmailFormat(emailInput)) {
      throw new BadRequestException("Geçerli bir e-posta adresi giriniz.");
    }

    const email = normalizeEmail(emailInput);
    const now = new Date();

    // Check cooldown for active non-consumed challenges
    const existingActive = await this.prisma.emailLoginChallenge.findFirst({
      where: {
        email,
        consumedAt: null,
        expiresAt: { gt: now }
      },
      orderBy: { createdAt: "desc" }
    });

    if (existingActive) {
      const secondsSinceLastSent = (now.getTime() - existingActive.lastSentAt.getTime()) / 1000;
      if (secondsSinceLastSent < EMAIL_OTP_RESEND_COOLDOWN_SECONDS) {
        // Return same generic message without sending duplicate email (prevents timing enumeration)
        return { message: "Kod gönderilebildiyse e-posta adresinize ulaştırıldı." };
      }
    }

    // Invalidate old active challenges for this email
    await this.prisma.emailLoginChallenge.updateMany({
      where: { email, consumedAt: null },
      data: { consumedAt: now }
    });

    // Generate new OTP
    const code = generateOtpCode();
    const otpHash = computeOtpHash(email, code);
    const expiresAt = new Date(now.getTime() + EMAIL_OTP_TTL_MINUTES * 60 * 1000);

    await this.prisma.emailLoginChallenge.create({
      data: {
        email,
        otpHash,
        expiresAt,
        lastSentAt: now
      }
    });

    try {
      await this.emailDeliveryService.sendOtp({
        to: email,
        code,
        expiresInMinutes: EMAIL_OTP_TTL_MINUTES
      });
    } catch (err) {
      this.logger.error(`Failed to dispatch OTP email: ${(err as Error)?.message}`);
      // Do not leak provider failure details to user
    }

    return { message: "Kod gönderilebildiyse e-posta adresinize ulaştırıldı." };
  }

  async verifyCode(
    emailInput: unknown,
    codeInput: unknown,
    displayNameInput?: unknown
  ): Promise<{
    user: {
      id: string;
      email: string;
      displayName: string;
      roles: RoleName[];
    };
    token: string;
  }> {
    if (!isEmailAuthEnabled()) {
      throw new ServiceUnavailableException("E-posta ile giriş sistemi devredışıdır.");
    }

    if (typeof emailInput !== "string" || !isValidEmailFormat(emailInput)) {
      throw new BadRequestException("Kod geçersiz veya süresi dolmuş.");
    }

    if (typeof codeInput !== "string" || !/^\d{6}$/.test(codeInput.trim())) {
      throw new BadRequestException("Kod geçersiz veya süresi dolmuş.");
    }

    const email = normalizeEmail(emailInput);
    const code = codeInput.trim();
    const now = new Date();

    const challenge = await this.prisma.emailLoginChallenge.findFirst({
      where: {
        email,
        consumedAt: null
      },
      orderBy: { createdAt: "desc" }
    });

    if (!challenge) {
      throw new BadRequestException("Kod geçersiz veya süresi dolmuş.");
    }

    if (challenge.expiresAt < now || challenge.failedAttempts >= EMAIL_OTP_MAX_FAILED_ATTEMPTS) {
      throw new BadRequestException("Kod geçersiz veya süresi dolmuş.");
    }

    const expectedHash = computeOtpHash(email, code);
    const isValid = compareOtpHashes(expectedHash, challenge.otpHash);

    if (!isValid) {
      await this.prisma.emailLoginChallenge.update({
        where: { id: challenge.id },
        data: { failedAttempts: { increment: 1 } }
      });
      throw new BadRequestException("Kod geçersiz veya süresi dolmuş.");
    }

    // Determine target role for new user or missing role
    const targetRole = isAguEmailDomain(email)
      ? RoleName.STUDENT
      : RoleName.EXTERNAL_PARTICIPANT;

    // Perform user resolution, role assignment, challenge consumption, and audit logging in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      // Consume challenge conditionally to prevent concurrent replay
      const consumed = await tx.emailLoginChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null
        },
        data: {
          consumedAt: now
        }
      });

      if (consumed.count === 0) {
        throw new BadRequestException("Kod geçersiz veya süresi dolmuş.");
      }

      let existingUser = await tx.user.findUnique({
        where: { email },
        include: { roles: true }
      });

      if (!existingUser) {
        if (
          typeof displayNameInput !== "string" ||
          !displayNameInput.trim()
        ) {
          throw new BadRequestException("Yeni kullanıcılar için ad soyad zorunludur.");
        }

        const sanitizedDisplayName = displayNameInput
          .trim()
          .replace(/<[^>]*>/g, ""); // Basic strip HTML

        if (!sanitizedDisplayName) {
          throw new BadRequestException("Geçerli bir ad soyad giriniz.");
        }

        existingUser = await tx.user.create({
          data: {
            email,
            displayName: sanitizedDisplayName,
            isActive: true,
            roles: {
              create: [{ role: targetRole }]
            }
          },
          include: { roles: true }
        });
      } else {
        // User exists: keep existing roles intact! If targetRole missing, add it.
        const hasRole = existingUser.roles.some((r) => r.role === targetRole);
        if (!hasRole) {
          await tx.userRole.create({
            data: {
              userId: existingUser.id,
              role: targetRole
            }
          });
          existingUser = await tx.user.findUniqueOrThrow({
            where: { id: existingUser.id },
            include: { roles: true }
          });
        }
      }

      // Record AuditLog
      await tx.auditLog.create({
        data: {
          actorId: existingUser.id,
          entityType: "User",
          entityId: existingUser.id,
          action: "EMAIL_LOGIN_SUCCEEDED",
          metadata: {
            method: "EMAIL_OTP",
            targetRole
          }
        }
      });

      return existingUser;
    });

    const token = await this.authSessionService.createSessionToken(user.id);
    const userRoles = user.roles.map((r) => r.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles: userRoles
      },
      token
    };
  }
}

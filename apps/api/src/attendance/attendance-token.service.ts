import { QR_ATTENDANCE_TOKEN_TTL_SECONDS, getQrAttendanceSecret } from "@agu/config";
import { BadRequestException, Injectable } from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type QrAttendanceTokenPayload = {
  eventId: string;
  purpose: "attendance-check-in";
  iat: number;
  exp: number;
  nonce: string;
};

@Injectable()
export class AttendanceTokenService {
  private base64UrlEncode(data: string | Buffer): string {
    const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    return buf.toString("base64url");
  }

  private base64UrlDecode(str: string): string {
    return Buffer.from(str, "base64url").toString("utf8");
  }

  private sign(payloadString: string, secret: string): string {
    const hmac = createHmac("sha256", secret);
    hmac.update(payloadString);
    return this.base64UrlEncode(hmac.digest());
  }

  generateAttendanceToken(eventId: string, customTtlSeconds?: number): { token: string; expiresAt: Date } {
    const secret = getQrAttendanceSecret();
    const ttlSeconds = customTtlSeconds ?? QR_ATTENDANCE_TOKEN_TTL_SECONDS;
    const nowMs = Date.now();
    const iat = Math.floor(nowMs / 1000);
    const exp = iat + ttlSeconds;
    const expiresAt = new Date(exp * 1000);
    const nonce = randomBytes(12).toString("hex");

    const header = { alg: "HS256", typ: "JWT" };
    const payload: QrAttendanceTokenPayload = {
      eventId,
      purpose: "attendance-check-in",
      iat,
      exp,
      nonce
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const signature = this.sign(unsignedToken, secret);
    const token = `${unsignedToken}.${signature}`;

    return { token, expiresAt };
  }

  verifyAttendanceToken(tokenString: string): QrAttendanceTokenPayload {
    if (typeof tokenString !== "string" || !tokenString.trim()) {
      throw new BadRequestException("Attendance token is required.");
    }

    const parts = tokenString.trim().split(".");
    if (parts.length !== 3) {
      throw new BadRequestException("Attendance token is invalid or expired.");
    }

    const [encodedHeader, encodedPayload, providedSignature] = parts;
    if (!encodedHeader || !encodedPayload || !providedSignature) {
      throw new BadRequestException("Attendance token is invalid or expired.");
    }

    const secret = getQrAttendanceSecret();
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = this.sign(unsignedToken, secret);

    const providedBuf = Buffer.from(providedSignature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
      throw new BadRequestException("Attendance token is invalid or expired.");
    }

    let payload: QrAttendanceTokenPayload;
    try {
      payload = JSON.parse(this.base64UrlDecode(encodedPayload)) as QrAttendanceTokenPayload;
    } catch {
      throw new BadRequestException("Attendance token is invalid or expired.");
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.eventId !== "string" ||
      !payload.eventId ||
      payload.purpose !== "attendance-check-in" ||
      typeof payload.exp !== "number"
    ) {
      throw new BadRequestException("Attendance token is invalid or expired.");
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSeconds) {
      throw new BadRequestException("Attendance token is invalid or expired.");
    }

    return payload;
  }
}

import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AttendanceTokenService } from "./attendance-token.service";

describe("AttendanceTokenService", () => {
  const service = new AttendanceTokenService();
  const sampleEventId = "11111111-1111-4111-8111-111111111111";

  it("generates a valid signed token containing required claims and nonce", () => {
    const { token, expiresAt } = service.generateAttendanceToken(sampleEventId);

    expect(typeof token).toBe("string");
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const verified = service.verifyAttendanceToken(token);
    expect(verified.eventId).toBe(sampleEventId);
    expect(verified.purpose).toBe("attendance-check-in");
    expect(typeof verified.nonce).toBe("string");
    expect(verified.nonce.length).toBeGreaterThan(0);
    expect(verified.exp).toBeGreaterThan(verified.iat);
  });

  it("rejects token with tampered signature", () => {
    const { token } = service.generateAttendanceToken(sampleEventId);
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.tamperedSignature12345`;

    expect(() => service.verifyAttendanceToken(tampered)).toThrow(BadRequestException);
  });

  it("rejects token with tampered payload content", () => {
    const { token } = service.generateAttendanceToken(sampleEventId);
    const parts = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        eventId: "22222222-2222-4222-8222-222222222222",
        purpose: "attendance-check-in",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 90,
        nonce: "fake"
      })
    ).toString("base64url");
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    expect(() => service.verifyAttendanceToken(tampered)).toThrow(BadRequestException);
  });

  it("rejects expired token", () => {
    // Generate token with -5 seconds TTL (already expired)
    const { token } = service.generateAttendanceToken(sampleEventId, -5);

    expect(() => service.verifyAttendanceToken(token)).toThrow(BadRequestException);
  });

  it("rejects empty or malformed token string", () => {
    expect(() => service.verifyAttendanceToken("")).toThrow(BadRequestException);
    expect(() => service.verifyAttendanceToken("invalid-format")).toThrow(BadRequestException);
    expect(() => service.verifyAttendanceToken("part1.part2")).toThrow(BadRequestException);
  });
});

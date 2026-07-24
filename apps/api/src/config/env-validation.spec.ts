import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateProductionEnv } from "./env-validation";

describe("validateProductionEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should not throw in non-production", () => {
    process.env.NODE_ENV = "development";
    expect(() => validateProductionEnv()).not.toThrow();
  });

  it("should throw if variables are missing in production", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "";
    process.env.WEB_ORIGIN = "";
    process.env.AUTH_SESSION_SECRET = "";
    process.env.QR_ATTENDANCE_SECRET = "";

    expect(() => validateProductionEnv()).toThrow(/Missing DATABASE_URL/);
    expect(() => validateProductionEnv()).toThrow(/Missing AUTH_SESSION_SECRET/);
    expect(() => validateProductionEnv()).toThrow(/Missing QR_ATTENDANCE_SECRET/);
    expect(() => validateProductionEnv()).toThrow(/Missing WEB_ORIGIN/);
  });

  it("should throw if secrets are too short", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://";
    process.env.WEB_ORIGIN = "https://example.com";
    process.env.AUTH_SESSION_SECRET = "short";
    process.env.QR_ATTENDANCE_SECRET = "short";

    expect(() => validateProductionEnv()).toThrow(
      /AUTH_SESSION_SECRET must be at least 32 characters long/
    );
    expect(() => validateProductionEnv()).toThrow(
      /QR_ATTENDANCE_SECRET must be at least 32 characters long/
    );
  });

  it("should throw if WEB_ORIGIN is *", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://";
    process.env.WEB_ORIGIN = "*";
    process.env.AUTH_SESSION_SECRET = "12345678901234567890123456789012";
    process.env.QR_ATTENDANCE_SECRET = "12345678901234567890123456789012";

    expect(() => validateProductionEnv()).toThrow(/WEB_ORIGIN must not be '\*'/);
  });

  it("should throw if AUTH_SESSION_SECRET is default", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://";
    process.env.WEB_ORIGIN = "https://example.com";
    process.env.AUTH_SESSION_SECRET = "replace-with-a-local-development-session-secret";
    process.env.QR_ATTENDANCE_SECRET = "12345678901234567890123456789012";

    expect(() => validateProductionEnv()).toThrow(
      /AUTH_SESSION_SECRET must be changed in production/
    );
  });

  it("should throw if QR_ATTENDANCE_SECRET is default", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://";
    process.env.WEB_ORIGIN = "https://example.com";
    process.env.AUTH_SESSION_SECRET = "12345678901234567890123456789012";
    process.env.QR_ATTENDANCE_SECRET = "dev-qr-attendance-secret-change-in-production";

    expect(() => validateProductionEnv()).toThrow(
      /QR_ATTENDANCE_SECRET must be changed in production/
    );
  });

  it("should throw if ENABLE_DEV_AUTH is true in production", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://";
    process.env.WEB_ORIGIN = "https://example.com";
    process.env.AUTH_SESSION_SECRET = "12345678901234567890123456789012";
    process.env.QR_ATTENDANCE_SECRET = "12345678901234567890123456789012";
    process.env.ENABLE_DEV_AUTH = "true";

    expect(() => validateProductionEnv()).toThrow(
      /ENABLE_DEV_AUTH must not be 'true' in production/
    );
  });

  it("should not throw if all valid", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://";
    process.env.WEB_ORIGIN = "https://example.com";
    process.env.AUTH_SESSION_SECRET = "12345678901234567890123456789012";
    process.env.QR_ATTENDANCE_SECRET = "12345678901234567890123456789012";
    process.env.ENABLE_DEV_AUTH = "false";

    expect(() => validateProductionEnv()).not.toThrow();
  });
});

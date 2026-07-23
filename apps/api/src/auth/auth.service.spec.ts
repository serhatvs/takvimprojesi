import { ForbiddenException } from "@nestjs/common";
import { afterEach, describe, expect, it } from "vitest";
import { AuthService } from "./auth.service";

const originalEnv = { ...process.env };

describe("AuthService", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("blocks development auth in production even when explicitly enabled", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      ENABLE_DEV_AUTH: "true"
    };

    const service = new AuthService({} as never);

    expect(service.isDevAuthAvailable()).toBe(false);
    expect(() => service.ensureDevAuthAvailable()).toThrow(ForbiddenException);
  });

  it("blocks development auth when the feature flag is disabled", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      ENABLE_DEV_AUTH: "false"
    };

    const service = new AuthService({} as never);

    expect(service.isDevAuthAvailable()).toBe(false);
    expect(() => service.ensureDevAuthAvailable()).toThrow(ForbiddenException);
  });
});

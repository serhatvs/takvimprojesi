import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { securityHeaders } from "./security-headers.middleware";
import type { Request, Response } from "express";

describe("securityHeaders", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: Mock;

  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    req = {};
    res = {
      setHeader: vi.fn()
    };
    next = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should set basic security headers", () => {
    process.env.NODE_ENV = "development";
    securityHeaders(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    expect(res.setHeader).toHaveBeenCalledWith("X-XSS-Protection", "0");
    expect(res.setHeader).toHaveBeenCalledWith("Referrer-Policy", "strict-origin-when-cross-origin");
    expect(res.setHeader).not.toHaveBeenCalledWith("Strict-Transport-Security", expect.any(String));
    expect(next).toHaveBeenCalled();
  });

  it("should set Strict-Transport-Security in production", () => {
    process.env.NODE_ENV = "production";
    securityHeaders(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  });
});

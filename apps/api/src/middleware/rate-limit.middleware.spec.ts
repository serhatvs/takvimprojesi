import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { rateLimit, _resetHitsForTesting } from "./rate-limit.middleware";
import type { Request, Response } from "express";

describe("rateLimit", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: Mock;
  let statusMock: Mock;
  let jsonMock: Mock;

  beforeEach(() => {
    _resetHitsForTesting();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    req = {
      ip: "127.0.0.1",
      path: "/auth/dev-login",
      socket: { remoteAddress: "127.0.0.1" }
    } as unknown as Request;
    res = { status: statusMock } as unknown as Partial<Response>;
    next = vi.fn();
  });

  it("should allow requests under the limit", () => {
    for (let i = 0; i < 5; i++) {
      rateLimit(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(i + 1);
    }
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("should block requests over the limit", () => {
    for (let i = 0; i < 6; i++) {
      rateLimit(req as Request, res as Response, next);
    }
    expect(next).toHaveBeenCalledTimes(5);
    expect(statusMock).toHaveBeenCalledWith(429);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 429,
      message: "Too many requests, please try again later."
    });
  });

  it("should not rate limit unknown routes", () => {
    const customReq = { ...req, path: "/some-other-route" } as unknown as Request;
    for (let i = 0; i < 20; i++) {
      rateLimit(customReq, res as Response, next);
    }
    expect(next).toHaveBeenCalledTimes(20);
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("should rate limit dynamic routes", () => {
    const customReq = { ...req, path: "/events/123/attendance-token" } as unknown as Request;
    for (let i = 0; i < 11; i++) {
      rateLimit(customReq, res as Response, next);
    }
    expect(next).toHaveBeenCalledTimes(10);
    expect(statusMock).toHaveBeenCalledWith(429);
  });
});

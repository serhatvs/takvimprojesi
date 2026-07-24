import type { Request, Response, NextFunction } from "express";

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

interface RequestLog {
  count: number;
  resetTime: number;
}

const RATE_LIMIT_ROUTES: Record<string, RateLimitConfig> = {
  "/auth/dev-login": { windowMs: 60_000, max: 5 },
  "/auth/email/request-code": { windowMs: 15 * 60_000, max: 10 },
  "/auth/email/verify-code": { windowMs: 15 * 60_000, max: 20 },
  "/attendance/check-in": { windowMs: 60_000, max: 10 }
};

const DYNAMIC_RATE_LIMITS = [
  { pattern: /^\/events\/[^/]+\/attendance-token$/, config: { windowMs: 60_000, max: 10 } }
];

const hits = new Map<string, RequestLog>();

function cleanup(now: number): void {
  for (const [key, record] of hits.entries()) {
    if (record.resetTime < now) {
      hits.delete(key);
    }
  }
}

function findConfig(path: string): RateLimitConfig | undefined {
  const exact = RATE_LIMIT_ROUTES[path];
  if (exact) return exact;

  for (const entry of DYNAMIC_RATE_LIMITS) {
    if (entry.pattern.test(path)) return entry.config;
  }

  return undefined;
}

/**
 * Simple in-memory per-IP rate limiter for sensitive endpoints.
 * Applied globally via app.use() in main.ts; skips non-configured routes.
 */
export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const config = findConfig(req.path);
  if (!config) {
    next();
    return;
  }

  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const key = `${req.path}:${ip}`;
  const now = Date.now();

  let record = hits.get(key);
  if (!record || record.resetTime < now) {
    record = { count: 1, resetTime: now + config.windowMs };
    hits.set(key, record);
  } else {
    record.count++;
  }

  // Probabilistic cleanup of expired entries
  if (Math.random() < 0.05) {
    cleanup(now);
  }

  if (record.count > config.max) {
    res.status(429).json({
      statusCode: 429,
      message: "Too many requests, please try again later."
    });
    return;
  }

  next();
}

/** Visible for testing */
export function _resetHitsForTesting(): void {
  hits.clear();
}

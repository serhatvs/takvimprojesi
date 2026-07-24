import { describe, it, expect, vi, beforeEach } from "vitest";
import { HealthService } from "./health.service";
import { PrismaService } from "../prisma/prisma.service";
import { DEFAULT_TIME_ZONE } from "@agu/config";

describe("HealthService", () => {
  let healthService: HealthService;
  let prismaService: PrismaService;

  beforeEach(() => {
    prismaService = {
      $queryRaw: vi.fn()
    } as unknown as PrismaService;
    healthService = new HealthService(prismaService);
  });

  describe("getHealth", () => {
    it("should return ok status", () => {
      const result = healthService.getHealth();
      expect(result.status).toBe("ok");
      expect(result.service).toBe("agu-api");
      expect(result.timeZone).toBe(DEFAULT_TIME_ZONE);
      expect(result.checkedAt).toBeDefined();
    });
  });

  describe("getReady", () => {
    it("should return ok if db is connected", async () => {
      vi.mocked(prismaService.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);
      const result = await healthService.getReady();
      expect(result.status).toBe("ok");
      expect(result.service).toBe("agu-api");
    });

    it("should return error if db connection fails", async () => {
      vi.mocked(prismaService.$queryRaw).mockRejectedValueOnce(new Error("Connection failed"));
      const result = await healthService.getReady();
      expect(result.status).toBe("error");
      expect(result.error).toBe("Database connection failed");
    });
  });
});

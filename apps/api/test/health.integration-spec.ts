import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";

describe("GET /health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns API health metadata", async () => {
    const response = await request(app.getHttpServer()).get("/health").expect(200);

    expect(response.body).toMatchObject({
      status: "ok",
      service: "agu-api",
      timeZone: "Europe/Istanbul"
    });
    expect(response.body.checkedAt).toEqual(expect.any(String));
  });
});

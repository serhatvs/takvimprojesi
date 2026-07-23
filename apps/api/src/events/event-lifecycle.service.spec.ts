import { UnprocessableEntityException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { EventLifecycleService } from "./event-lifecycle.service";

describe("EventLifecycleService", () => {
  const service = new EventLifecycleService();

  it("allows configured transitions for matching roles", () => {
    expect(() =>
      service.assertTransitionAllowed("SUBMITTED", "APPROVED", ["PRESS_EDITOR"])
    ).not.toThrow();
  });

  it("rejects invalid status transitions", () => {
    expect(() =>
      service.assertTransitionAllowed("DRAFT", "PUBLISHED", ["CLUB_ADMIN"])
    ).toThrow(UnprocessableEntityException);
  });
});

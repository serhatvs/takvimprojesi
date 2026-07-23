import { describe, expect, it } from "vitest";
import { canTransitionEvent } from "./event-lifecycle";

describe("event lifecycle contract", () => {
  it("allows club admins to submit draft events", () => {
    expect(canTransitionEvent("DRAFT", "SUBMITTED", ["CLUB_ADMIN"])).toBe(true);
  });

  it("blocks unsupported transitions", () => {
    expect(canTransitionEvent("DRAFT", "PUBLISHED", ["CLUB_ADMIN"])).toBe(false);
  });
});

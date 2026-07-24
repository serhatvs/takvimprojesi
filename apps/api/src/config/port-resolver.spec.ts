import { DEFAULT_API_PORT } from "@agu/config";
import { describe, expect, it } from "vitest";
import { resolveApiPort } from "./port-resolver";

describe("resolveApiPort", () => {
  it("prioritizes process.env.PORT over API_PORT and default", () => {
    const port = resolveApiPort({
      PORT: "8080",
      API_PORT: "4000"
    });
    expect(port).toBe(8080);
  });

  it("falls back to process.env.API_PORT when PORT is not set", () => {
    const port = resolveApiPort({
      API_PORT: "4000"
    });
    expect(port).toBe(4000);
  });

  it("falls back to DEFAULT_API_PORT when neither PORT nor API_PORT is set", () => {
    const port = resolveApiPort({});
    expect(port).toBe(Number(DEFAULT_API_PORT));
  });

  it("handles invalid or non-numeric port strings safely", () => {
    const port1 = resolveApiPort({ PORT: "invalid" });
    expect(port1).toBe(Number(DEFAULT_API_PORT));

    const port2 = resolveApiPort({ PORT: "-1" });
    expect(port2).toBe(Number(DEFAULT_API_PORT));

    const port3 = resolveApiPort({ PORT: "70000" });
    expect(port3).toBe(Number(DEFAULT_API_PORT));
  });
});

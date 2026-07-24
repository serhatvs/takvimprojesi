import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { BadRequestException, ArgumentsHost } from "@nestjs/common";
import type { Response } from "express";

describe("AllExceptionsFilter", () => {
  let filter: AllExceptionsFilter;
  let statusMock: Mock;
  let jsonMock: Mock;
  let res: Partial<Response>;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    res = { status: statusMock } as unknown as Partial<Response>;
    host = {
      switchToHttp: () => ({
        getResponse: () => res
      })
    } as unknown as ArgumentsHost;
  });

  it("should format HttpExceptions cleanly", () => {
    const exception = new BadRequestException("Invalid data");
    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 400,
      message: "Invalid data",
      error: "Bad Request"
    });
  });

  it("should handle unhandled runtime errors with generic 500 without leaking stack traces", () => {
    const unhandledError = new Error(
      "Database connection postgresql://user:pass@host:5432/db failed"
    );
    filter.catch(unhandledError, host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 500,
      message: "Internal server error"
    });
    const callArgs = jsonMock.mock.calls[0];
    expect(callArgs).toBeDefined();
    if (callArgs) {
      const sentResponse = callArgs[0];
      expect(JSON.stringify(sentResponse)).not.toContain("postgresql://");
      expect(JSON.stringify(sentResponse)).not.toContain("stack");
    }
  });
});

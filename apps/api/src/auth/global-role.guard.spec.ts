import "reflect-metadata";
import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { GLOBAL_ROLES_KEY } from "./auth.constants";
import { GlobalRoleGuard } from "./global-role.guard";
import type { Principal } from "./principal";

function createContext(handler: () => void, user?: Principal): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ user })
    })
  } as unknown as ExecutionContext;
}

const principal: Principal = {
  userId: "user-1",
  email: "press.dev@agu.edu.tr",
  displayName: "Press Editor",
  globalRoles: ["PRESS_EDITOR"],
  clubMemberships: []
};

describe("GlobalRoleGuard", () => {
  it("allows a principal with one of the required global roles", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(GLOBAL_ROLES_KEY, ["PRESS_EDITOR"], handler);

    const guard = new GlobalRoleGuard(new Reflector());

    expect(guard.canActivate(createContext(handler, principal))).toBe(true);
  });

  it("denies a principal without the required global role", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(GLOBAL_ROLES_KEY, ["SYSTEM_ADMIN"], handler);

    const guard = new GlobalRoleGuard(new Reflector());

    expect(() => guard.canActivate(createContext(handler, principal))).toThrow(ForbiddenException);
  });
});

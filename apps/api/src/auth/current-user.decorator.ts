import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestWithPrincipal } from "./principal";

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
  return request.user;
});

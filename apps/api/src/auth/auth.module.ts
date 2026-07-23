import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthenticationGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AuthSessionService } from "./auth-session.service";
import { AuthorizationService } from "./authorization.service";
import { GlobalRoleGuard } from "./global-role.guard";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, AuthSessionService, AuthenticationGuard, GlobalRoleGuard, AuthorizationService],
  exports: [AuthService, AuthenticationGuard, GlobalRoleGuard, AuthorizationService]
})
export class AuthModule {}

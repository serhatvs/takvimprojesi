import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthenticationGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AuthSessionService } from "./auth-session.service";
import { AuthorizationService } from "./authorization.service";
import { GlobalRoleGuard } from "./global-role.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailOtpService } from "./email/email-otp.service";
import {
  ConsoleEmailDeliveryService,
  EmailDeliveryService,
  SmtpEmailDeliveryService
} from "./email/email-delivery.service";

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    AuthenticationGuard,
    GlobalRoleGuard,
    AuthorizationService,
    EmailOtpService,
    {
      provide: EmailDeliveryService,
      useFactory: () => {
        const mode = process.env.EMAIL_DELIVERY_MODE ?? "console";
        if (mode === "smtp") {
          return new SmtpEmailDeliveryService();
        }
        return new ConsoleEmailDeliveryService();
      }
    }
  ],
  exports: [
    AuthService,
    AuthSessionService,
    AuthenticationGuard,
    GlobalRoleGuard,
    AuthorizationService,
    EmailOtpService,
    EmailDeliveryService
  ]
})
export class AuthModule {}

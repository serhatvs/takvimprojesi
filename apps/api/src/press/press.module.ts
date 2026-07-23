import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PressController } from "./press.controller";
import { PressService } from "./press.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [PressController],
  providers: [PressService]
})
export class PressModule {}

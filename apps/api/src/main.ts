import { DEFAULT_API_PORT } from "@agu/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import "reflect-metadata";
import { AppModule } from "./app.module";
import { loadRootEnv } from "./config/load-env";
import { validateProductionEnv } from "./config/env-validation";
import { securityHeaders } from "./middleware/security-headers.middleware";
import { rateLimit } from "./middleware/rate-limit.middleware";

async function bootstrap() {
  loadRootEnv();
  validateProductionEnv();

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.use(securityHeaders);
  app.use(rateLimit);
  app.enableCors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.WEB_ORIGIN
        : (process.env.WEB_ORIGIN ?? "http://localhost:3000"),
    credentials: true
  });

  const port = Number(process.env.API_PORT ?? DEFAULT_API_PORT);
  await app.listen(port);
}

void bootstrap();

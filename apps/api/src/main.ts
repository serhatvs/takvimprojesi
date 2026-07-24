import { DEFAULT_API_PORT } from "@agu/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import "reflect-metadata";
import { AppModule } from "./app.module";
import { loadRootEnv } from "./config/load-env";
import { validateProductionEnv } from "./config/env-validation";
import { securityHeaders } from "./middleware/security-headers.middleware";
import { rateLimit } from "./middleware/rate-limit.middleware";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";

async function bootstrap() {
  loadRootEnv();
  validateProductionEnv();

  const app = await NestFactory.create(AppModule);

  // Disable framework information leakage header
  const adapter = app.getHttpAdapter();
  if (adapter && typeof adapter.getInstance === "function") {
    const instance = adapter.getInstance();
    if (instance && typeof instance.disable === "function") {
      instance.disable("x-powered-by");
    }
  }

  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(cookieParser());
  app.use(securityHeaders);
  app.use(rateLimit);
  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      if (process.env.NODE_ENV !== "production") {
        callback(null, true);
        return;
      }

      const allowedOrigin = process.env.WEB_ORIGIN;
      if (!requestOrigin || requestOrigin === allowedOrigin) {
        callback(null, true);
      } else {
        callback(new Error("CORS origin not allowed"));
      }
    },
    credentials: true
  });

  const port = Number(process.env.API_PORT ?? DEFAULT_API_PORT);
  await app.listen(port);
}

void bootstrap();

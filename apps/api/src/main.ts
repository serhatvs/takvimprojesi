import { DEFAULT_API_PORT } from "@agu/config";
import { NestFactory } from "@nestjs/core";
import "reflect-metadata";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000"
  });

  const port = Number(process.env.API_PORT ?? DEFAULT_API_PORT);
  await app.listen(port);
}

void bootstrap();

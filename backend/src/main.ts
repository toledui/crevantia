import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: false,
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  app.setGlobalPrefix("api/v1");
  // El editor envía el documento versionado completo. 2 MB cubre DPO-PRO sin
  // aceptar cargas JSON de tamaño indefinido. rawBody es requerido para webhooks de Stripe.
  app.useBodyParser("json", {
    limit: "2mb",
    verify: (req: any, _res: any, buf: Buffer) => {
      req.rawBody = buf;
    },
  });
  app.useBodyParser("urlencoded", { limit: "1mb", extended: true });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.getOrThrow<string>("FRONTEND_URL"),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  await app.listen(Number(config.get("PORT") ?? 4000));
}

void bootstrap();

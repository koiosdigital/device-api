import 'reflect-metadata';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '@/rest/app.module';
import { HttpExceptionFilter } from '@/rest/common/filters';
import { LoggerService } from '@/shared/logger';
import {
  REST_API_DESCRIPTION,
  REST_API_RELEASE,
  REST_API_TITLE,
  REST_API_VERSION,
  REST_DOCUMENTATION_PATH,
  CORS_ALLOWED_ORIGINS,
} from './config/rest.constants';

export type RestServerOptions = {
  port?: number;
};

export async function startRestServer(options: RestServerOptions = {}): Promise<void> {
  const port = options.port ?? 9090;

  const logger = new LoggerService();
  logger.setContext('REST');

  const app = await NestFactory.create(AppModule, {
    logger: LoggerService.getLogLevels(),
  });

  app.enableCors({
    origin: CORS_ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  app.enableShutdownHooks();
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: REST_API_VERSION,
  });

  const config = new DocumentBuilder()
    .setTitle(REST_API_TITLE)
    .setDescription(REST_API_DESCRIPTION)
    .setVersion(REST_API_RELEASE)
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Paste an access token issued by the OIDC provider',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(REST_DOCUMENTATION_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  logger.log(`REST server listening on port ${port}`);
}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5174';
  app.enableCors({ origin: frontendOrigin, credentials: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const port = Number(process.env.API_PORT || 3000);
  await app.listen(port, process.env.API_HOST || '127.0.0.1');
}
bootstrap();

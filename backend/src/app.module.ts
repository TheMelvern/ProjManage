import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { HealthController } from './health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, ProjectsController],
  providers: [PrismaService, ProjectsService]
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { HealthController } from './health.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { TasksController } from './tasks.controller';
import { ReportsController } from './reports.controller';
import { RaidController } from './raid.controller';
import { TimesheetsController } from './timesheets.controller';
import { RegistrationController, ReviewsController } from './reviews.controller';
import { LeaveController, ParametersController } from './workflow-modules.controller';
import { AdministrationController } from './administration.controller';
import { OperationProposalsController } from './proposals.controller';
import { ThrottleService } from './throttle.service';
import { NotificationsController } from './notifications.controller';
import { ProfileController } from './profile.controller';
import { EmailService } from './email.service';
import { EmailTokenService } from './email-token.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32) throw new Error('JWT_SECRET must have at least 32 characters');
        return { secret, signOptions: { issuer: 'pmo-portal-local', audience: 'pmo-api' },
          verifyOptions: { issuer: 'pmo-portal-local', audience: 'pmo-api' } };
      }
    })
  ],
  controllers: [HealthController, AuthController, ProjectsController, TasksController, ReportsController, RaidController, TimesheetsController, RegistrationController, ReviewsController, LeaveController, ParametersController, AdministrationController, OperationProposalsController, NotificationsController, ProfileController],
  providers: [PrismaService, ProjectsService, AuthService, AuthGuard, ThrottleService, EmailService, EmailTokenService]
})
export class AppModule {}

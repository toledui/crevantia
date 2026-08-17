import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccessTokenGuard } from './common/access-token.guard';
import { RolesGuard } from './common/roles.guard';
import { PermissionsGuard } from './common/permissions.guard';
import { DatabaseModule } from './database/database.module';
import { AdminController } from './modules/admin/admin.controller';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './modules/health/health.controller';
import { MailModule } from './modules/mail/mail.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { TestsModule } from './modules/tests/tests.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { NormsModule } from './modules/norms/norms.module';
import { ResultsModule } from './modules/results/results.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({ global: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    MailModule,
    AuthModule,
    RolesModule,
    UsersModule,
    TestsModule,
    AssessmentsModule,
    NormsModule,
    ResultsModule,
  ],
  controllers: [HealthController, AdminController],
  providers: [
    AccessTokenGuard,
    RolesGuard,
    PermissionsGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

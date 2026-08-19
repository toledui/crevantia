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
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { TestsModule } from './modules/tests/tests.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { NormsModule } from './modules/norms/norms.module';
import { ResultsModule } from './modules/results/results.module';
import { FinancialModule } from './modules/financial/financial.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { StripeModule } from './modules/stripe/stripe.module';
import { LegalModule } from './modules/legal/legal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({ global: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    HealthModule,
    MailModule,
    AuthModule,
    RolesModule,
    UsersModule,
    TestsModule,
    AssessmentsModule,
    NormsModule,
    ResultsModule,
    FinancialModule,
    CommerceModule,
    StripeModule,
    LegalModule,
  ],
  controllers: [AdminController],
  providers: [
    AccessTokenGuard,
    RolesGuard,
    PermissionsGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

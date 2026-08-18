import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { FinancialModule } from '../financial/financial.module';
import { StripeAdminController } from './stripe-admin.controller';
import { StripePublicController } from './stripe-public.controller';
import { StripeService } from './stripe.service';

@Module({
  imports: [CommerceModule, FinancialModule],
  controllers: [StripeAdminController, StripePublicController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}

import { Module } from '@nestjs/common';
import { FinancialModule } from '../financial/financial.module';
import { CheckoutService } from './checkout.service';
import { CommerceAdminController } from './commerce-admin.controller';
import { CheckoutPublicController, PricingPublicController, UserOrdersController } from './commerce-public.controller';
import { CouponsService } from './coupons.service';
import { PricingService } from './pricing.service';
import { ReceiptService } from './receipt.service';

@Module({
  imports: [FinancialModule],
  controllers: [CommerceAdminController, PricingPublicController, CheckoutPublicController, UserOrdersController],
  providers: [PricingService, CouponsService, CheckoutService, ReceiptService],
  exports: [PricingService, CouponsService, CheckoutService, ReceiptService],
})
export class CommerceModule {}

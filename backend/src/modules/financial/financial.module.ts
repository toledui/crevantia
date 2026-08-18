import { Module } from '@nestjs/common';
import { FinancialController, PublicFinancialController } from './financial.controller';
import { FinancialService } from './financial.service';

@Module({
  controllers: [FinancialController, PublicFinancialController],
  providers: [FinancialService],
  exports: [FinancialService],
})
export class FinancialModule {}

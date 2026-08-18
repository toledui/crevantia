import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateFinancialSettingsDto } from './financial.dto';

@Injectable()
export class FinancialService {
  private readonly logger = new Logger(FinancialService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.financialSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      settings = await this.prisma.financialSettings.create({
        data: {
          id: 'default',
          currency: 'MXN',
          decimalPlaces: 2,
          taxName: 'IVA',
          taxRatePercent: 16.0,
          pricesIncludeTax: false,
        },
      });
    }
    return {
      currency: settings.currency,
      decimalPlaces: settings.decimalPlaces,
      taxName: settings.taxName,
      taxRatePercent: Number(settings.taxRatePercent),
      pricesIncludeTax: settings.pricesIncludeTax,
      updatedAt: settings.updatedAt,
    };
  }

  async updateSettings(actorId: string, dto: UpdateFinancialSettingsDto) {
    const updated = await this.prisma.financialSettings.upsert({
      where: { id: 'default' },
      update: {
        currency: dto.currency.trim().toUpperCase(),
        decimalPlaces: dto.decimalPlaces,
        taxName: dto.taxName.trim(),
        taxRatePercent: dto.taxRatePercent,
        pricesIncludeTax: dto.pricesIncludeTax,
      },
      create: {
        id: 'default',
        currency: dto.currency.trim().toUpperCase(),
        decimalPlaces: dto.decimalPlaces,
        taxName: dto.taxName.trim(),
        taxRatePercent: dto.taxRatePercent,
        pricesIncludeTax: dto.pricesIncludeTax,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'FINANCIAL_SETTINGS_UPDATED',
        entityType: 'FinancialSettings',
        entityId: 'default',
        metadata: {
          currency: updated.currency,
          decimalPlaces: updated.decimalPlaces,
          taxName: updated.taxName,
          taxRatePercent: Number(updated.taxRatePercent),
          pricesIncludeTax: updated.pricesIncludeTax,
        },
      },
    });

    return {
      currency: updated.currency,
      decimalPlaces: updated.decimalPlaces,
      taxName: updated.taxName,
      taxRatePercent: Number(updated.taxRatePercent),
      pricesIncludeTax: updated.pricesIncludeTax,
      updatedAt: updated.updatedAt,
    };
  }
}

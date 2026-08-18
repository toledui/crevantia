import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CouponDiscountType, type EvaluationProduct } from '../../generated/prisma/client';
import { CreateCouponDto, UpdateCouponDto } from './commerce.dto';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCoupons() {
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { redemptions: true, purchaseOrders: true } },
      },
    });

    return coupons.map((c) => ({
      id: c.id,
      code: c.code,
      description: c.description,
      discountType: c.discountType,
      discountValue: Number(c.discountValue),
      minPurchaseAmountCents: c.minPurchaseAmountCents,
      minPurchaseAmountFormatted: (c.minPurchaseAmountCents / 100).toFixed(2),
      maxUsesGlobal: c.maxUsesGlobal,
      maxUsesPerUser: c.maxUsesPerUser,
      usedCount: c.usedCount,
      startsAt: c.startsAt,
      expiresAt: c.expiresAt,
      isActive: c.isActive,
      applicableProductIds: c.applicableProductIds,
      createdAt: c.createdAt,
      redemptionsCount: c._count.redemptions,
    }));
  }

  async createCoupon(actorId: string, dto: CreateCouponDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException(`Ya existe un cupón con el código ${code}.`);
    }

    if (dto.discountType === CouponDiscountType.PERCENTAGE && (dto.discountValue <= 0 || dto.discountValue > 100)) {
      throw new BadRequestException('El descuento porcentual debe estar entre 0.01% y 100%.');
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        description: dto.description?.trim(),
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minPurchaseAmountCents: dto.minPurchaseAmountCents ?? 0,
        maxUsesGlobal: dto.maxUsesGlobal,
        maxUsesPerUser: dto.maxUsesPerUser ?? 1,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
        applicableProductIds: dto.applicableProductIds ? dto.applicableProductIds : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'COUPON_CREATED',
        entityType: 'Coupon',
        entityId: coupon.id,
        metadata: { code: coupon.code, discountType: coupon.discountType, discountValue: Number(coupon.discountValue) },
      },
    });

    return coupon;
  }

  async updateCoupon(actorId: string, id: string, dto: UpdateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('El cupón no existe.');

    if (
      dto.discountType === CouponDiscountType.PERCENTAGE &&
      dto.discountValue !== undefined &&
      (dto.discountValue <= 0 || dto.discountValue > 100)
    ) {
      throw new BadRequestException('El descuento porcentual debe estar entre 0.01% y 100%.');
    }

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: {
        description: dto.description !== undefined ? dto.description?.trim() : undefined,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minPurchaseAmountCents: dto.minPurchaseAmountCents,
        maxUsesGlobal: dto.maxUsesGlobal,
        maxUsesPerUser: dto.maxUsesPerUser,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        isActive: dto.isActive,
        applicableProductIds: dto.applicableProductIds !== undefined ? dto.applicableProductIds : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'COUPON_UPDATED',
        entityType: 'Coupon',
        entityId: id,
        metadata: { changes: JSON.parse(JSON.stringify(dto)) },
      },
    });

    return updated;
  }

  async toggleCoupon(actorId: string, id: string, isActive: boolean) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('El cupón no existe.');

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: { isActive },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: isActive ? 'COUPON_ACTIVATED' : 'COUPON_DEACTIVATED',
        entityType: 'Coupon',
        entityId: id,
      },
    });

    return updated;
  }

  async validateCoupon(code: string, product: { id: string }, userId?: string, subtotalCents = 0) {
    const normalizedCode = code.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({ where: { code: normalizedCode } });

    if (!coupon) {
      throw new NotFoundException(`El cupón "${normalizedCode}" no es válido.`);
    }

    if (!coupon.isActive) {
      throw new BadRequestException('Este cupón se encuentra inactivo.');
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('Este cupón aún no entra en vigencia.');
    }

    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('Este cupón ha expirado.');
    }

    if (coupon.maxUsesGlobal && coupon.usedCount >= coupon.maxUsesGlobal) {
      throw new BadRequestException('Este cupón ha alcanzado el límite máximo de usos.');
    }

    if (subtotalCents < coupon.minPurchaseAmountCents) {
      const minFormatted = (coupon.minPurchaseAmountCents / 100).toFixed(2);
      throw new BadRequestException(`El monto mínimo para aplicar este cupón es de $${minFormatted}.`);
    }

    if (coupon.applicableProductIds && Array.isArray(coupon.applicableProductIds)) {
      const productIds = coupon.applicableProductIds as string[];
      if (productIds.length > 0 && !productIds.includes(product.id)) {
        throw new BadRequestException('Este cupón no es aplicable a la evaluación seleccionada.');
      }
    }

    if (userId) {
      const userRedemptions = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, userId, status: { in: ['CONFIRMED', 'RESERVED'] } },
      });
      if (userRedemptions >= coupon.maxUsesPerUser) {
        throw new BadRequestException('Has alcanzado el límite de usos permitidos para este cupón.');
      }
    }

    // Calculate discount amount in cents
    let discountCents = 0;
    const discountVal = Number(coupon.discountValue);
    if (coupon.discountType === CouponDiscountType.PERCENTAGE) {
      discountCents = Math.round((subtotalCents * discountVal) / 100);
    } else {
      // Fixed amount discount in cents
      discountCents = Math.min(subtotalCents, Math.round(discountVal * 100));
    }

    // Discount cannot exceed subtotal
    discountCents = Math.min(discountCents, subtotalCents);

    return {
      coupon,
      discountCents,
      discountFormatted: (discountCents / 100).toFixed(2),
      discountType: coupon.discountType,
      discountValue: discountVal,
      description: coupon.description,
    };
  }
}

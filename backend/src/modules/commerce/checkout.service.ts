import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { AuthenticatedUser } from '../../common/auth.types';
import { PrismaService } from '../../database/prisma.service';
import {
  AssignmentStatus,
  AssignmentType,
  OrderStatus,
  type Prisma,
} from '../../generated/prisma/client';
import { FinancialService } from '../financial/financial.service';
import { MailService } from '../mail/mail.service';
import { CreateOrderDto, ProcessPaymentDto, QueryOrdersDto, QuoteCheckoutDto, RefundOrderDto } from './commerce.dto';
import { CouponsService } from './coupons.service';
import { PricingService } from './pricing.service';
import { ReceiptService } from './receipt.service';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financial: FinancialService,
    private readonly pricing: PricingService,
    private readonly coupons: CouponsService,
    private readonly receiptService: ReceiptService,
    private readonly mailService: MailService,
  ) {}

  async quote(dto: QuoteCheckoutDto, userId?: string) {
    const product = await this.pricing.getProductBySlug(dto.productSlug);
    const financialSettings = await this.financial.getSettings();

    const originalSubtotalCents = product.currentPrice.amountCents;
    let discountCents = 0;
    let appliedCoupon: any = null;

    if (dto.couponCode?.trim()) {
      const validated = await this.coupons.validateCoupon(
        dto.couponCode,
        { id: product.id },
        userId,
        originalSubtotalCents,
      );
      discountCents = validated.discountCents;
      appliedCoupon = {
        code: validated.coupon.code,
        description: validated.description,
        discountType: validated.discountType,
        discountValue: validated.discountValue,
        discountCents: validated.discountCents,
        discountFormatted: (validated.discountCents / 100).toFixed(financialSettings.decimalPlaces),
      };
    }

    const discountedSubtotalCents = Math.max(0, originalSubtotalCents - discountCents);
    const taxRate = financialSettings.taxRatePercent;
    let taxCents = 0;
    let totalCents = 0;

    if (financialSettings.pricesIncludeTax) {
      // Price already includes tax.
      // Base subtotal without tax = discountedSubtotal / (1 + taxRate / 100)
      const baseSubtotal = Math.round(discountedSubtotalCents / (1 + taxRate / 100));
      taxCents = discountedSubtotalCents - baseSubtotal;
      totalCents = discountedSubtotalCents;
    } else {
      // Tax is added to subtotal
      taxCents = Math.round((discountedSubtotalCents * taxRate) / 100);
      totalCents = discountedSubtotalCents + taxCents;
    }

    const stripeSettings = await this.prisma.stripeSettings?.findUnique?.({ where: { id: 'default' } });
    const gatewayActive = Boolean(stripeSettings?.enabled);

    let isAlreadyAssigned = false;
    let existingAssignmentStatus: string | null = null;
    let existingAttemptId: string | null = null;
    let existingResultRunId: string | null = null;

    if (userId) {
      const existing = await this.prisma.assignment.findFirst({
        where: {
          userId,
          testId: product.testId,
          status: { in: [AssignmentStatus.AVAILABLE, AssignmentStatus.IN_PROGRESS, AssignmentStatus.COMPLETED, AssignmentStatus.PENDING] },
        },
        include: {
          attempt: {
            include: {
              resultRuns: { where: { status: 'COMPLETED' }, take: 1, orderBy: { calculatedAt: 'desc' } },
            },
          },
        },
      });

      if (existing) {
        isAlreadyAssigned = true;
        existingAssignmentStatus = existing.attempt?.status || existing.status;
        existingAttemptId = existing.attempt?.id || null;
        existingResultRunId = existing.attempt?.resultRuns?.[0]?.id || null;
      }
    }

    return {
      product: {
        id: product.id,
        code: product.code,
        slug: product.slug,
        name: product.name,
        shortDescription: product.shortDescription,
        publishedVersion: product.publishedVersion,
        estimatedMin: product.estimatedMin,
        testId: product.testId,
      },
      priceVersionId: product.currentPrice.id,
      currency: financialSettings.currency,
      decimalPlaces: financialSettings.decimalPlaces,
      taxName: financialSettings.taxName,
      taxRatePercent: taxRate,
      pricesIncludeTax: financialSettings.pricesIncludeTax,
      subtotalCents: originalSubtotalCents,
      subtotalFormatted: (originalSubtotalCents / 100).toFixed(financialSettings.decimalPlaces),
      discountCents,
      discountFormatted: (discountCents / 100).toFixed(financialSettings.decimalPlaces),
      taxCents,
      taxFormatted: (taxCents / 100).toFixed(financialSettings.decimalPlaces),
      totalCents,
      totalFormatted: (totalCents / 100).toFixed(financialSettings.decimalPlaces),
      appliedCoupon,
      isAlreadyAssigned,
      existingAssignmentStatus,
      existingAttemptId,
      existingResultRunId,
      gatewayActive,
    };
  }

  async createOrder(user: AuthenticatedUser | { sub: string } | string | undefined, dto: CreateOrderDto) {
    const actorId = typeof user === 'string' ? user : user?.sub;
    const quote = await this.quote({ productSlug: dto.productSlug, couponCode: dto.couponCode }, actorId);

    let customerEmail = dto.customerEmail?.trim().toLowerCase() || '';
    let customerName = dto.customerName?.trim() || '';
    let targetUserId = actorId;

    if (targetUserId) {
      const dbUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
      if (dbUser) {
        if (!customerEmail) customerEmail = dbUser.email;
        if (!customerName) customerName = `${dbUser.firstName} ${dbUser.lastName}`.trim();
      }
    } else if (customerEmail) {
      let dbUser = await this.prisma.user.findUnique({ where: { email: customerEmail } });
      if (!dbUser) {
        const [firstName, ...rest] = customerName ? customerName.split(' ') : ['Cliente', 'Crevantia'];
        const lastName = rest.join(' ') || 'Crevantia';
        dbUser = await this.prisma.user.create({
          data: {
            email: customerEmail,
            passwordHash: await argon2.hash(randomBytes(16).toString('hex')),
            firstName: firstName || 'Cliente',
            lastName: lastName || 'Crevantia',
            status: 'PENDING_VERIFICATION',
          },
        });
      }
      targetUserId = dbUser.id;
    }

    if (!targetUserId) {
      throw new BadRequestException('Se requiere un usuario autenticado o correo electrónico del comprador.');
    }

    // Verify user doesn't already have an active assignment for this test
    const existingAssignment = await this.prisma.assignment.findFirst({
      where: {
        userId: targetUserId,
        testId: quote.product.testId,
        status: { in: [AssignmentStatus.AVAILABLE, AssignmentStatus.IN_PROGRESS, AssignmentStatus.COMPLETED, AssignmentStatus.PENDING] },
      },
    });
    if (existingAssignment) {
      throw new ConflictException(
        'Ya cuentas con un acceso activo o completado para esta evaluación. No es necesario comprarla nuevamente.',
      );
    }

    const orderNumber = `ORD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${randomBytes(3).toString('hex').toUpperCase()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          orderNumber,
          userId: targetUserId!,
          productId: quote.product.id,
          priceVersionId: quote.priceVersionId,
          couponId: quote.appliedCoupon ? (await tx.coupon.findUnique({ where: { code: quote.appliedCoupon.code } }))?.id : null,
          status: OrderStatus.PENDING,
          currency: quote.currency,
          subtotalCents: quote.subtotalCents,
          discountCents: quote.discountCents,
          taxName: quote.taxName,
          taxRatePercent: quote.taxRatePercent,
          pricesIncludeTax: quote.pricesIncludeTax,
          taxCents: quote.taxCents,
          totalCents: quote.totalCents,
          customerEmail,
          customerName: customerName || customerEmail,
          items: {
            create: {
              productId: quote.product.id,
              priceVersionId: quote.priceVersionId,
              productCode: quote.product.code,
              productName: quote.product.name,
              unitPriceCents: quote.subtotalCents,
              quantity: 1,
              totalCents: quote.subtotalCents,
            },
          },
        },
        include: {
          items: true,
          product: true,
        },
      });

      if (quote.appliedCoupon) {
        const coupon = await tx.coupon.findUnique({ where: { code: quote.appliedCoupon.code } });
        if (coupon) {
          await tx.couponRedemption.create({
            data: {
              couponId: coupon.id,
              userId: targetUserId!,
              orderId: created.id,
              discountCents: quote.discountCents,
              status: 'RESERVED',
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: targetUserId,
          action: 'PURCHASE_ORDER_CREATED',
          entityType: 'PurchaseOrder',
          entityId: created.id,
          metadata: { orderNumber: created.orderNumber, totalCents: created.totalCents },
        },
      });

      return created;
    });

    return {
      id: order.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      totalCents: order.totalCents,
      totalFormatted: (order.totalCents / 100).toFixed(2),
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      userId: order.userId,
      product: {
        id: quote.product.id,
        name: order.product.name,
        code: order.product.code,
        slug: quote.product.slug,
        shortDescription: quote.product.shortDescription,
      },
    };
  }

  async processPayment(userOrSystem: AuthenticatedUser | { sub: string } | string | undefined, dto: ProcessPaymentDto) {
    const actorId = typeof userOrSystem === 'string' ? userOrSystem : userOrSystem?.sub;
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id: dto.orderId },
      include: {
        product: {
          include: {
            test: {
              include: {
                versions: {
                  where: { status: 'PUBLISHED' },
                  orderBy: { version: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        items: true,
        coupon: true,
      },
    });

    if (!order) throw new NotFoundException('La orden de compra no existe.');
    if (actorId && actorId !== 'STRIPE_WEBHOOK' && actorId !== 'SYSTEM' && order.userId !== actorId) {
      throw new ForbiddenException('No tienes acceso a esta orden de compra.');
    }
    if (order.status === OrderStatus.PAID) {
      return {
        success: true,
        message: 'La orden ya se encuentra pagada y asignada.',
        orderId: order.id,
        orderNumber: order.orderNumber,
        assignmentId: order.assignmentId,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          totalFormatted: (order.totalCents / 100).toFixed(2),
          product: {
            name: order.product.name,
            code: order.product.code,
          },
        },
      };
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`No es posible procesar el pago de una orden en estado ${order.status}.`);
    }

    const gateway = dto.gateway || 'SIMULATED';
    const simulateSuccess = dto.simulateSuccess !== false;

    if (order.totalCents > 0 && gateway === 'SIMULATED') {
      const stripeSettings = await this.prisma.stripeSettings?.findUnique?.({ where: { id: 'default' } });
      if (stripeSettings && !stripeSettings.enabled) {
        throw new BadRequestException(
          'La pasarela de pagos se encuentra desactivada. No es posible procesar pagos directos en este momento.',
        );
      }
    }

    if (!simulateSuccess) {
      await this.prisma.paymentTransaction.create({
        data: {
          orderId: order.id,
          gateway,
          amountCents: order.totalCents,
          currency: order.currency,
          status: 'FAILED',
          rawResponse: { reason: 'Pago rechazado por el emisor' },
        },
      });
      throw new BadRequestException('El pago fue rechazado por el procesador.');
    }

    // Verify product has published test version
    const publishedVersion = order.product.test.versions[0];
    if (!publishedVersion) {
      throw new BadRequestException('La evaluación comprada no tiene una versión psicométrica publicada disponible.');
    }

    // Execute transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          gateway,
          gatewayTransactionId: dto.gatewayTransactionId || `TX-${randomBytes(6).toString('hex').toUpperCase()}`,
          amountCents: order.totalCents,
          currency: order.currency,
          status: 'SUCCEEDED',
          rawResponse: { simulated: gateway === 'SIMULATED', processedAt: new Date().toISOString() },
        },
      });

      // Create Assignment for user
      const assignment = await tx.assignment.create({
        data: {
          userId: order.userId,
          testId: order.product.testId,
          testVersionId: publishedVersion.id,
          type: AssignmentType.PURCHASE,
          status: AssignmentStatus.AVAILABLE,
          reason: `Compra de orden ${order.orderNumber}`,
        },
      });

      // Update Order
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
          assignmentId: assignment.id,
        },
      });

      // Confirm coupon redemption
      if (order.couponId) {
        await tx.couponRedemption.updateMany({
          where: { orderId: order.id },
          data: { status: 'CONFIRMED' },
        });
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { increment: 1 } },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: actorId || order.userId,
          action: 'ORDER_PAID_AND_ASSIGNED',
          entityType: 'PurchaseOrder',
          entityId: order.id,
          metadata: {
            orderNumber: order.orderNumber,
            assignmentId: assignment.id,
            totalCents: order.totalCents,
            transactionId: transaction.id,
          },
        },
      });

      return { updatedOrder, assignment, transaction };
    });

    // Generate PDF and send receipt email asynchronously
    try {
      const fullOrder = await this.prisma.purchaseOrder.findUnique({
        where: { id: order.id },
        include: {
          product: true,
          coupon: true,
          transactions: { orderBy: { createdAt: 'desc' } },
        },
      });

      if (fullOrder) {
        const pdfBuffer = await this.receiptService.generateReceiptPdf({
          orderNumber: fullOrder.orderNumber,
          createdAt: fullOrder.createdAt,
          paidAt: fullOrder.paidAt,
          status: fullOrder.status,
          currency: fullOrder.currency,
          subtotalCents: fullOrder.subtotalCents,
          discountCents: fullOrder.discountCents,
          taxName: fullOrder.taxName,
          taxRatePercent: Number(fullOrder.taxRatePercent),
          taxCents: fullOrder.taxCents,
          totalCents: fullOrder.totalCents,
          customerName: fullOrder.customerName,
          customerEmail: fullOrder.customerEmail,
          product: fullOrder.product,
          coupon: fullOrder.coupon,
          transactions: fullOrder.transactions,
        });

        const [firstName] = fullOrder.customerName ? fullOrder.customerName.split(' ') : ['Cliente'];
        await this.mailService.sendPurchaseReceiptEmail(
          fullOrder.customerEmail,
          firstName || 'Cliente',
          {
            orderNumber: fullOrder.orderNumber,
            productName: fullOrder.product.name,
            totalFormatted: (fullOrder.totalCents / 100).toFixed(2),
            currency: fullOrder.currency,
          },
          pdfBuffer,
        );
      }
    } catch (mailErr) {
      this.logger.error('Error al generar o enviar recibo por correo:', mailErr);
    }

    return {
      success: true,
      message: '¡Pago completado exitosamente! Tu evaluación ha sido asignada y está lista para comenzar.',
      orderId: result.updatedOrder.id,
      orderNumber: result.updatedOrder.orderNumber,
      assignmentId: result.assignment.id,
      transactionId: result.transaction.gatewayTransactionId,
      order: {
        id: result.updatedOrder.id,
        orderNumber: result.updatedOrder.orderNumber,
        totalFormatted: (result.updatedOrder.totalCents / 100).toFixed(2),
        product: {
          name: order.product.name,
          code: order.product.code,
        },
      },
    };
  }

  async refundOrder(actorId: string, orderId: string, dto: RefundOrderDto) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        assignment: { include: { attempt: true } },
      },
    });

    if (!order) throw new NotFoundException('La orden no existe.');
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Solo es posible reembolsar órdenes pagadas.');
    }

    if (order.assignment?.attempt && order.assignment.attempt.status === 'COMPLETED') {
      throw new BadRequestException('No se puede reembolsar una evaluación que ya ha sido completada y puntuada.');
    }

    const refunded = await this.prisma.$transaction(async (tx) => {
      // Revoke assignment if exists and not completed
      if (order.assignmentId) {
        await tx.assignment.update({
          where: { id: order.assignmentId },
          data: { status: AssignmentStatus.REVOKED, reason: `Reembolso de orden: ${dto.reason}` },
        });
      }

      // Record refund transaction
      await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          gateway: 'REFUND',
          amountCents: order.totalCents,
          currency: order.currency,
          status: 'REFUNDED',
          rawResponse: { reason: dto.reason },
        },
      });

      // Update Order
      const updated = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: OrderStatus.REFUNDED },
      });

      // Release coupon if was used
      if (order.couponId) {
        await tx.couponRedemption.updateMany({
          where: { orderId: order.id },
          data: { status: 'RELEASED' },
        });
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ORDER_REFUNDED',
          entityType: 'PurchaseOrder',
          entityId: order.id,
          metadata: { orderNumber: order.orderNumber, reason: dto.reason },
        },
      });

      return updated;
    });

    return refunded;
  }

  async getOrders(query: QueryOrdersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = {
      status: query.status,
      OR: query.search
        ? [
            { orderNumber: { contains: query.search } },
            { customerEmail: { contains: query.search } },
            { customerName: { contains: query.search } },
          ]
        : undefined,
    };

    const [total, items] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { code: true, name: true } },
          coupon: { select: { code: true, discountType: true, discountValue: true } },
          transactions: { orderBy: { createdAt: 'desc' }, take: 1 },
          assignment: { select: { id: true, status: true } },
        },
      }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        orderNumber: item.orderNumber,
        status: item.status,
        currency: item.currency,
        subtotalFormatted: (item.subtotalCents / 100).toFixed(2),
        discountFormatted: (item.discountCents / 100).toFixed(2),
        taxFormatted: (item.taxCents / 100).toFixed(2),
        totalFormatted: (item.totalCents / 100).toFixed(2),
        totalCents: item.totalCents,
        taxName: item.taxName,
        taxRatePercent: Number(item.taxRatePercent),
        pricesIncludeTax: item.pricesIncludeTax,
        customerName: item.customerName,
        customerEmail: item.customerEmail,
        productName: item.product.name,
        couponCode: item.coupon?.code ?? null,
        assignmentId: item.assignment?.id ?? null,
        assignmentStatus: item.assignment?.status ?? null,
        lastTransaction: item.transactions[0]
          ? {
              gateway: item.transactions[0].gateway,
              status: item.transactions[0].status,
              reference: item.transactions[0].gatewayTransactionId,
            }
          : null,
        paidAt: item.paidAt,
        createdAt: item.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrder(orderId: string, userId?: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        coupon: true,
        items: true,
        transactions: { orderBy: { createdAt: 'desc' } },
        assignment: { select: { id: true, status: true } },
      },
    });

    if (!order) throw new NotFoundException('La orden no existe.');
    if (userId && order.userId !== userId) throw new ForbiddenException('Acceso no autorizado.');

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      subtotalFormatted: (order.subtotalCents / 100).toFixed(2),
      discountFormatted: (order.discountCents / 100).toFixed(2),
      taxFormatted: (order.taxCents / 100).toFixed(2),
      totalFormatted: (order.totalCents / 100).toFixed(2),
      taxName: order.taxName,
      taxRatePercent: Number(order.taxRatePercent),
      pricesIncludeTax: order.pricesIncludeTax,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      product: {
        name: order.product.name,
        code: order.product.code,
        slug: order.product.slug,
      },
      coupon: order.coupon ? { code: order.coupon.code, discountType: order.coupon.discountType } : null,
      assignmentId: order.assignment?.id ?? null,
      assignmentStatus: order.assignment?.status ?? null,
      transactions: order.transactions,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    };
  }

  async getUserOrders(userId: string) {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: true,
        coupon: true,
        transactions: { orderBy: { createdAt: 'desc' }, take: 1 },
        assignment: { select: { id: true, status: true, attempt: { select: { id: true, status: true } } } },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      subtotalFormatted: (order.subtotalCents / 100).toFixed(2),
      discountFormatted: (order.discountCents / 100).toFixed(2),
      taxFormatted: (order.taxCents / 100).toFixed(2),
      totalFormatted: (order.totalCents / 100).toFixed(2),
      totalCents: order.totalCents,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      product: {
        id: order.product.id,
        name: order.product.name,
        code: order.product.code,
        slug: order.product.slug,
      },
      couponCode: order.coupon?.code ?? null,
      assignmentId: order.assignment?.id ?? null,
      assignmentStatus: order.assignment?.status ?? null,
      attemptId: order.assignment?.attempt?.id ?? null,
      attemptStatus: order.assignment?.attempt?.status ?? null,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    }));
  }

  async getOrderReceiptPdf(userId: string | undefined, orderId: string): Promise<{ filename: string; buffer: Buffer }> {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        coupon: true,
        transactions: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) throw new NotFoundException('La orden no existe.');
    if (userId && order.userId && order.userId !== userId) throw new ForbiddenException('No tienes acceso al recibo de esta orden.');

    const buffer = await this.receiptService.generateReceiptPdf({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      status: order.status,
      currency: order.currency,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      taxName: order.taxName,
      taxRatePercent: Number(order.taxRatePercent),
      taxCents: order.taxCents,
      totalCents: order.totalCents,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      product: order.product,
      coupon: order.coupon,
      transactions: order.transactions,
    });

    return {
      filename: `Recibo_${order.orderNumber}.pdf`,
      buffer,
    };
  }

  async sendPendingReminder(orderId: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { product: true },
    });
    if (!order || order.status !== OrderStatus.PENDING) {
      return { success: false, message: 'La orden no está en estado pendiente.' };
    }
    const [firstName] = order.customerName ? order.customerName.split(' ') : ['Cliente'];
    await this.mailService.sendPendingPaymentReminderEmail(
      order.customerEmail,
      firstName || 'Cliente',
      {
        orderNumber: order.orderNumber,
        productName: order.product.name,
        slug: order.product.slug,
        totalFormatted: (order.totalCents / 100).toFixed(2),
        currency: order.currency,
      },
    );
    return { success: true, message: `Recordatorio enviado a ${order.customerEmail}.` };
  }
}

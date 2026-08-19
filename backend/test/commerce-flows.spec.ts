import { CouponDiscountType, OrderStatus } from '../src/generated/prisma/client';
import { CheckoutService } from '../src/modules/commerce/checkout.service';
import { CouponsService } from '../src/modules/commerce/coupons.service';
import { PricingService } from '../src/modules/commerce/pricing.service';
import { FinancialService } from '../src/modules/financial/financial.service';

describe('Commerce & Financial Flows', () => {
  let financialService: FinancialService;
  let pricingService: PricingService;
  let couponsService: CouponsService;
  let checkoutService: CheckoutService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      financialSettings: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      stripeSettings: {
        findUnique: jest.fn().mockResolvedValue({ enabled: true }),
      },
      evaluationProduct: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      priceVersion: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      coupon: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      couponRedemption: {
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      purchaseOrder: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      assignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      paymentTransaction: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      user: {
        findUniqueOrThrow: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
    };

    financialService = new FinancialService(prismaMock);
    pricingService = new PricingService(prismaMock);
    couponsService = new CouponsService(prismaMock);
    const receiptServiceMock = { generateReceiptPdf: jest.fn().mockResolvedValue(Buffer.from('PDF_CONTENT')) } as any;
    const mailServiceMock = { sendPurchaseReceiptEmail: jest.fn().mockResolvedValue(undefined), sendPendingPaymentReminderEmail: jest.fn().mockResolvedValue(undefined) } as any;
    checkoutService = new CheckoutService(prismaMock, financialService, pricingService, couponsService, receiptServiceMock, mailServiceMock);
  });

  describe('Financial Tax & Quote Calculations', () => {
    it('calculates quote correctly when prices DO NOT include tax (tax added to subtotal)', async () => {
      // 16% IVA not included, product price $2,200.00 MXN (220000 cents), 10% discount coupon
      prismaMock.evaluationProduct.findUnique.mockResolvedValue({
        id: 'prod-1',
        code: 'DPO-PRO',
        slug: 'dpo-pro',
        name: 'Evaluación DPO-PRO',
        isActive: true,
        test: {
          id: 'test-1',
          code: 'DPO',
          name: 'DPO Test',
          versions: [{ id: 'tv-1', version: 1, estimatedMin: 45 }],
        },
        priceVersions: [
          { id: 'pv-1', amountCents: 220000, currency: 'MXN', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true },
        ],
      });

      prismaMock.financialSettings.findUnique.mockResolvedValue({
        id: 'default',
        currency: 'MXN',
        decimalPlaces: 2,
        taxName: 'IVA',
        taxRatePercent: 16.0,
        pricesIncludeTax: false,
      });

      prismaMock.coupon.findUnique.mockResolvedValue({
        id: 'coup-1',
        code: 'DESCUENTO10',
        isActive: true,
        discountType: CouponDiscountType.PERCENTAGE,
        discountValue: 10,
        minPurchaseAmountCents: 0,
        maxUsesGlobal: 100,
        maxUsesPerUser: 1,
        usedCount: 5,
        startsAt: null,
        expiresAt: null,
        applicableProductIds: null,
      });

      prismaMock.couponRedemption.count.mockResolvedValue(0);

      const quote = await checkoutService.quote({ productSlug: 'dpo-pro', couponCode: 'DESCUENTO10' }, 'user-1');

      // Subtotal = 220000 ($2,200.00)
      // Discount = 22000 ($220.00)
      // Discounted subtotal = 198000 ($1,980.00)
      // Tax (16%) = 198000 * 0.16 = 31680 ($316.80)
      // Total = 198000 + 31680 = 229680 ($2,296.80)
      expect(quote.subtotalCents).toBe(220000);
      expect(quote.subtotalFormatted).toBe('2200.00');
      expect(quote.discountCents).toBe(22000);
      expect(quote.discountFormatted).toBe('220.00');
      expect(quote.taxCents).toBe(31680);
      expect(quote.taxFormatted).toBe('316.80');
      expect(quote.totalCents).toBe(229680);
      expect(quote.totalFormatted).toBe('2296.80');
    });

    it('calculates quote correctly when prices ALREADY INCLUDE tax', async () => {
      // 16% IVA included, product price $2,200.00 MXN (220000 cents), no coupon
      prismaMock.evaluationProduct.findUnique.mockResolvedValue({
        id: 'prod-1',
        code: 'DPO-PRO',
        slug: 'dpo-pro',
        name: 'Evaluación DPO-PRO',
        isActive: true,
        test: {
          id: 'test-1',
          code: 'DPO',
          name: 'DPO Test',
          versions: [{ id: 'tv-1', version: 1, estimatedMin: 45 }],
        },
        priceVersions: [
          { id: 'pv-1', amountCents: 220000, currency: 'MXN', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true },
        ],
      });

      prismaMock.financialSettings.findUnique.mockResolvedValue({
        id: 'default',
        currency: 'MXN',
        decimalPlaces: 2,
        taxName: 'IVA',
        taxRatePercent: 16.0,
        pricesIncludeTax: true,
      });

      const quote = await checkoutService.quote({ productSlug: 'dpo-pro' });

      // Total = 220000 ($2,200.00)
      // Base subtotal = Math.round(220000 / 1.16) = 189655 ($1,896.55)
      // Tax included = 220000 - 189655 = 30345 ($303.45)
      expect(quote.totalCents).toBe(220000);
      expect(quote.totalFormatted).toBe('2200.00');
      expect(quote.taxCents).toBe(30345);
      expect(quote.taxFormatted).toBe('303.45');
    });
  });

  describe('Payment and Automated Assignment Creation', () => {
    it('creates assignment and confirms coupon redemption upon successful payment', async () => {
      prismaMock.purchaseOrder.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-202608-TEST',
        userId: 'user-1',
        status: OrderStatus.PENDING,
        currency: 'MXN',
        totalCents: 220000,
        couponId: 'coup-1',
        product: {
          testId: 'test-1',
          test: {
            versions: [{ id: 'tv-1', version: 1, status: 'PUBLISHED' }],
          },
        },
      });

      prismaMock.assignment.create.mockResolvedValue({
        id: 'assign-1',
        userId: 'user-1',
        testId: 'test-1',
        testVersionId: 'tv-1',
        status: 'AVAILABLE',
      });

      prismaMock.purchaseOrder.update.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-202608-TEST',
        status: OrderStatus.PAID,
      });

      prismaMock.paymentTransaction.create.mockResolvedValue({
        id: 'pt-1',
        gatewayTransactionId: 'TX-12345',
      });

      const result = await checkoutService.processPayment(
        { sub: 'user-1', email: 'user@example.com', roles: ['USER'], permissions: [] },
        { orderId: 'order-1', gateway: 'SIMULATED', simulateSuccess: true },
      );

      expect(result.success).toBe(true);
      expect(prismaMock.assignment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          testId: 'test-1',
          testVersionId: 'tv-1',
          type: 'PURCHASE',
          status: 'AVAILABLE',
        }),
      });
      expect(prismaMock.couponRedemption.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'order-1' },
        data: { status: 'CONFIRMED' },
      });
    });
  });
});

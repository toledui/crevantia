import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../mail/encryption.service';
import { CheckoutService } from '../commerce/checkout.service';
import { CreateStripeCheckoutSessionDto, TestStripeSettingsDto, UpdateStripeSettingsDto } from './stripe.dto';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    private readonly checkoutService: CheckoutService,
  ) {}

  async getAdminSettings() {
    const settings = await this.prisma.stripeSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      return {
        enabled: false,
        mode: 'test',
        publishableKey: '',
        hasSecretKey: false,
        hasWebhookSecret: false,
        updatedAt: null,
      };
    }
    return {
      enabled: settings.enabled,
      mode: settings.mode as 'test' | 'live',
      publishableKey: settings.publishableKey,
      hasSecretKey: Boolean(settings.secretKeyCipher),
      hasWebhookSecret: Boolean(settings.webhookSecretCipher),
      updatedAt: settings.updatedAt,
    };
  }

  async updateAdminSettings(actorId: string, dto: UpdateStripeSettingsDto) {
    const existing = await this.prisma.stripeSettings.findUnique({ where: { id: 'default' } });

    const secretKeyCipher = dto.secretKey?.trim()
      ? this.encryption.encrypt(dto.secretKey.trim())
      : existing?.secretKeyCipher;

    const webhookSecretCipher = dto.webhookSecret?.trim()
      ? this.encryption.encrypt(dto.webhookSecret.trim())
      : existing?.webhookSecretCipher;

    const updated = await this.prisma.stripeSettings.upsert({
      where: { id: 'default' },
      update: {
        enabled: dto.enabled,
        mode: dto.mode,
        publishableKey: dto.publishableKey ? dto.publishableKey.trim() : existing?.publishableKey || '',
        secretKeyCipher,
        webhookSecretCipher,
      },
      create: {
        id: 'default',
        enabled: dto.enabled,
        mode: dto.mode,
        publishableKey: dto.publishableKey ? dto.publishableKey.trim() : '',
        secretKeyCipher,
        webhookSecretCipher,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'STRIPE_SETTINGS_UPDATED',
        entityType: 'StripeSettings',
        entityId: updated.id,
        metadata: {
          enabled: updated.enabled,
          mode: updated.mode,
          hasPublishableKey: Boolean(updated.publishableKey),
          hasSecretKey: Boolean(secretKeyCipher),
          hasWebhookSecret: Boolean(webhookSecretCipher),
        },
      },
    });

    return this.getAdminSettings();
  }

  async getPublicConfig() {
    const settings = await this.prisma.stripeSettings.findUnique({ where: { id: 'default' } });
    if (!settings || !settings.enabled) {
      const envKey = this.config.get<string>('STRIPE_PUBLISHABLE_KEY');
      return {
        enabled: Boolean(envKey),
        mode: envKey?.startsWith('pk_live_') ? 'live' : 'test',
        publishableKey: envKey || '',
      };
    }
    return {
      enabled: settings.enabled,
      mode: settings.mode,
      publishableKey: settings.publishableKey,
    };
  }

  async getDecryptedSecretKey(): Promise<string | null> {
    const settings = await this.prisma.stripeSettings.findUnique({ where: { id: 'default' } });
    if (settings?.secretKeyCipher) {
      try {
        return this.encryption.decrypt(settings.secretKeyCipher);
      } catch (err) {
        this.logger.error('Error al descifrar la clave secreta de Stripe', err);
      }
    }
    return this.config.get<string>('STRIPE_SECRET_KEY') || null;
  }

  async getDecryptedWebhookSecret(): Promise<string | null> {
    const settings = await this.prisma.stripeSettings.findUnique({ where: { id: 'default' } });
    if (settings?.webhookSecretCipher) {
      try {
        return this.encryption.decrypt(settings.webhookSecretCipher);
      } catch (err) {
        this.logger.error('Error al descifrar el secreto de webhook de Stripe', err);
      }
    }
    return this.config.get<string>('STRIPE_WEBHOOK_SECRET') || null;
  }

  async getStripeClient(customKey?: string): Promise<Stripe> {
    const settings = await this.prisma.stripeSettings.findUnique({ where: { id: 'default' } });
    if (!settings?.enabled && !customKey) {
      throw new ServiceUnavailableException(
        'La pasarela de pagos Stripe se encuentra actualmente desactivada en la plataforma.',
      );
    }
    const secretKey = customKey || (await this.getDecryptedSecretKey());
    if (!secretKey) {
      throw new ServiceUnavailableException(
        'Stripe no está configurado. Ingresa la clave secreta en Configuración > Pasarela de pago.',
      );
    }
    return new Stripe(secretKey);
  }

  async testConnection(actorId: string, dto?: TestStripeSettingsDto) {
    const secretKey = dto?.secretKey?.trim() || (await this.getDecryptedSecretKey());
    if (!secretKey) {
      throw new BadRequestException('No se ha proporcionado una clave secreta para probar la conexión.');
    }

    try {
      const stripe = new Stripe(secretKey);
      const customers = await stripe.customers.list({ limit: 1 });
      const isLive = secretKey.startsWith('sk_live_');

      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'STRIPE_CONNECTION_TESTED',
          entityType: 'StripeSettings',
          metadata: { isLive, success: true },
        },
      });

      return {
        success: true,
        message: `Conexión exitosa con Stripe en modo ${isLive ? 'PRODUCCIÓN (Live)' : 'PRUEBAS (Test)'}.`,
        mode: isLive ? 'live' : 'test',
      };
    } catch (err: any) {
      this.logger.error('Error en prueba de conexión con Stripe', err);
      throw new BadRequestException(
        `Error de autenticación con Stripe: ${err.message || 'Clave secreta inválida'}`,
      );
    }
  }

  async createCheckoutSession(
    actor: { sub: string; email: string; firstName?: string; lastName?: string } | undefined,
    dto: CreateStripeCheckoutSessionDto,
  ) {
    const stripe = await this.getStripeClient();

    const customerEmail = (dto.customerEmail || actor?.email || '').trim().toLowerCase();
    const customerName = (
      dto.customerName ||
      (actor ? `${actor.firstName || ''} ${actor.lastName || ''}`.trim() : '') ||
      customerEmail
    ).trim();

    if (!customerEmail) {
      throw new BadRequestException('El correo del cliente es requerido para procesar el pago.');
    }

    // Create or retrieve pending order
    const order = await this.checkoutService.createOrder(actor?.sub, {
      productSlug: dto.productSlug,
      couponCode: dto.couponCode,
      customerEmail,
      customerName,
      idempotencyKey: `STRIPE_INIT_${dto.productSlug}_${Date.now()}`,
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: order.customerEmail,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: actor?.sub || order.userId,
        productCode: order.product.code,
      },
      line_items: [
        {
          price_data: {
            currency: order.currency.toLowerCase(),
            product_data: {
              name: order.product.name,
              description: order.product.shortDescription || 'Evaluación psicométrica profesional Crevantia',
            },
            unit_amount: order.totalCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/pago/${dto.productSlug}?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${frontendUrl}/pago/${dto.productSlug}?cancelled=true`,
    });

    return {
      sessionId: session.id,
      sessionUrl: session.url,
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  }

  async resumeCheckoutSession(
    actor: { sub: string; email: string } | undefined,
    orderId: string,
  ) {
    const stripe = await this.getStripeClient();
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { product: true },
    });

    if (!order) throw new NotFoundException('La orden no existe.');
    if (actor?.sub && order.userId !== actor.sub) {
      throw new ForbiddenException('No tienes acceso a esta orden de compra.');
    }
    if (order.status !== 'PENDING') {
      throw new BadRequestException(`No es posible pagar una orden en estado ${order.status}.`);
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: order.customerEmail,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        productCode: order.product.code,
      },
      line_items: [
        {
          price_data: {
            currency: order.currency.toLowerCase(),
            product_data: {
              name: order.product.name,
              description: order.product.shortDescription || 'Evaluación psicométrica profesional Crevantia',
            },
            unit_amount: order.totalCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/pago/${order.product.slug}?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${frontendUrl}/pago/${order.product.slug}?cancelled=true`,
    });

    return {
      sessionId: session.id,
      sessionUrl: session.url,
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  }

  async verifySession(sessionId: string) {
    const stripe = await this.getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      throw new NotFoundException('La sesión de Stripe no fue encontrada.');
    }

    const orderId = session.client_reference_id || session.metadata?.orderId;
    if (!orderId) {
      throw new BadRequestException('La sesión no contiene una orden asociada.');
    }

    if (session.payment_status === 'paid') {
      const result = await this.checkoutService.processPayment('STRIPE_VERIFY', {
        orderId,
        gateway: 'STRIPE',
        gatewayTransactionId: (session.payment_intent as string) || session.id,
        idempotencyKey: `STRIPE_SESSION_${session.id}`,
      });

      return {
        status: 'PAID',
        orderNumber: result.orderNumber,
        productName: result.order?.product.name || 'Evaluación',
        totalFormatted: result.order?.totalFormatted || '',
        assignmentId: result.assignmentId || null,
        message: 'Pago confirmado exitosamente.',
      };
    }

    return {
      status: session.payment_status.toUpperCase(),
      message: 'El pago aún se encuentra en proceso o no fue completado.',
    };
  }

  async handleWebhook(signature: string | undefined, rawBody: Buffer | undefined) {
    if (!signature || !rawBody) {
      throw new BadRequestException('Encabezado Stripe-Signature o cuerpo de la petición faltante.');
    }

    const webhookSecret = await this.getDecryptedWebhookSecret();
    if (!webhookSecret) {
      throw new ServiceUnavailableException('El secreto del Webhook de Stripe no está configurado.');
    }

    const stripe = await this.getStripeClient();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      this.logger.error('Firma inválida de webhook Stripe', err.message);
      throw new BadRequestException(`Firma de Webhook inválida: ${err.message}`);
    }

    // Idempotency check
    const existingEvent = await this.prisma.paymentEvent.findUnique({
      where: { eventId: event.id },
    });

    if (existingEvent?.processed) {
      return { received: true, status: 'ALREADY_PROCESSED' };
    }

    await this.prisma.paymentEvent.upsert({
      where: { eventId: event.id },
      update: {
        eventType: event.type,
        payload: event.data.object as any,
      },
      create: {
        gateway: 'STRIPE',
        eventId: event.id,
        eventType: event.type,
        signature,
        payload: event.data.object as any,
        processed: false,
      },
    });

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = session.client_reference_id || session.metadata?.orderId;
          if (orderId && session.payment_status === 'paid') {
            await this.checkoutService.processPayment('STRIPE_WEBHOOK', {
              orderId,
              gateway: 'STRIPE',
              gatewayTransactionId: (session.payment_intent as string) || session.id,
              idempotencyKey: `STRIPE_EVT_${event.id}`,
            });
          }
          break;
        }

        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;
          const paymentIntentId = charge.payment_intent as string;
          if (paymentIntentId) {
            const tx = await this.prisma.paymentTransaction.findFirst({
              where: { gatewayTransactionId: paymentIntentId },
            });
            if (tx) {
              await this.checkoutService.refundOrder('STRIPE_WEBHOOK', tx.orderId, {
                reason: 'Reembolso procesado desde el panel de Stripe',
              });
            }
          }
          break;
        }

        default:
          this.logger.log(`Evento de Stripe no manejado: ${event.type}`);
      }

      await this.prisma.paymentEvent.update({
        where: { eventId: event.id },
        data: { processed: true },
      });

      return { received: true };
    } catch (err: any) {
      this.logger.error(`Error al procesar evento de Stripe ${event.id}`, err);
      await this.prisma.paymentEvent.update({
        where: { eventId: event.id },
        data: { error: err.message || 'Error desconocido al procesar webhook' },
      });
      throw err;
    }
  }
}

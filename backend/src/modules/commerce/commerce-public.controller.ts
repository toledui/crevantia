import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/access-token.guard';
import { OptionalAccessTokenGuard } from '../../common/optional-access-token.guard';
import type { AuthenticatedUser } from '../../common/auth.types';
import { CurrentUser } from '../../common/current-user.decorator';
import { CheckoutService } from './checkout.service';
import { CreateOrderDto, ProcessPaymentDto, QuoteCheckoutDto } from './commerce.dto';
import { PricingService } from './pricing.service';

@Controller('pricing')
export class PricingPublicController {
  constructor(private readonly pricing: PricingService) {}

  @Get('products')
  getPublicProducts() {
    return this.pricing.getProducts(true);
  }

  @Get('products/featured')
  async getFeaturedProduct() {
    const products = await this.pricing.getProducts(true);
    return products[0] ?? null;
  }

  @Get('products/:slug')
  getProductBySlug(@Param('slug') slug: string) {
    return this.pricing.getProductBySlug(slug);
  }
}

@Controller('checkout')
export class CheckoutPublicController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalAccessTokenGuard)
  quote(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: QuoteCheckoutDto,
  ) {
    return this.checkout.quote(dto, user?.sub);
  }

  @Post('order')
  @UseGuards(AccessTokenGuard)
  createOrder(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.checkout.createOrder(user, dto);
  }

  @Post('pay')
  @UseGuards(AccessTokenGuard)
  processPayment(@CurrentUser() user: AuthenticatedUser, @Body() dto: ProcessPaymentDto) {
    return this.checkout.processPayment(user, dto);
  }

  @Get('orders/:id')
  @UseGuards(AccessTokenGuard)
  getOrder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.checkout.getOrder(id, user.sub);
  }

  @Get('orders/:id/receipt-pdf')
  @UseGuards(OptionalAccessTokenGuard)
  async downloadReceiptPdf(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Res() res: any,
  ) {
    const result = await this.checkout.getOrderReceiptPdf(user?.sub, id);
    const disposition = download === 'true' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    res.end(result.buffer);
  }

  @Post('orders/:id/reminder')
  @UseGuards(AccessTokenGuard)
  sendReminder(@Param('id') id: string) {
    return this.checkout.sendPendingReminder(id);
  }
}

@Controller('me')
export class UserOrdersController {
  constructor(private readonly checkout: CheckoutService) {}

  @Get('orders')
  @UseGuards(AccessTokenGuard)
  getUserOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.checkout.getUserOrders(user.sub);
  }
}

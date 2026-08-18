import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/access-token.guard';
import type { AuthenticatedUser } from '../../common/auth.types';
import { CurrentUser } from '../../common/current-user.decorator';
import { Permissions } from '../../common/permissions.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { CheckoutService } from './checkout.service';
import {
  CreateCouponDto,
  CreateProductDto,
  QueryOrdersDto,
  RefundOrderDto,
  SetProductPriceDto,
  UpdateCouponDto,
  UpdateProductDto,
} from './commerce.dto';
import { CouponsService } from './coupons.service';
import { PricingService } from './pricing.service';

@Controller('admin/commerce')
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class CommerceAdminController {
  constructor(
    private readonly pricing: PricingService,
    private readonly coupons: CouponsService,
    private readonly checkout: CheckoutService,
  ) {}

  // ----------------- PRODUCTS & PRICING -----------------
  @Get('products')
  @Permissions('pricing.manage', 'payments.read')
  getProducts() {
    return this.pricing.getProducts(false);
  }

  @Post('products')
  @Permissions('pricing.manage')
  createProduct(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductDto) {
    return this.pricing.createProduct(user.sub, dto);
  }

  @Patch('products/:id')
  @Permissions('pricing.manage')
  updateProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.pricing.updateProduct(user.sub, id, dto);
  }

  @Post('products/:id/price')
  @Permissions('pricing.manage')
  setProductPrice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetProductPriceDto,
  ) {
    return this.pricing.setProductPrice(user.sub, id, dto);
  }

  @Get('products/:id/prices')
  @Permissions('pricing.manage', 'payments.read')
  getPriceHistory(@Param('id') id: string) {
    return this.pricing.getPriceHistory(id);
  }

  // ----------------- COUPONS -----------------
  @Get('coupons')
  @Permissions('coupons.manage', 'payments.read')
  getCoupons() {
    return this.coupons.getCoupons();
  }

  @Post('coupons')
  @Permissions('coupons.manage')
  createCoupon(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCouponDto) {
    return this.coupons.createCoupon(user.sub, dto);
  }

  @Patch('coupons/:id')
  @Permissions('coupons.manage')
  updateCoupon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.coupons.updateCoupon(user.sub, id, dto);
  }

  @Patch('coupons/:id/toggle')
  @Permissions('coupons.manage')
  toggleCoupon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.coupons.toggleCoupon(user.sub, id, Boolean(isActive));
  }

  // ----------------- ORDERS & PAYMENTS -----------------
  @Get('orders')
  @Permissions('payments.read')
  getOrders(@Query() query: QueryOrdersDto) {
    return this.checkout.getOrders(query);
  }

  @Get('orders/:id')
  @Permissions('payments.read')
  getOrder(@Param('id') id: string) {
    return this.checkout.getOrder(id);
  }

  @Post('orders/:id/refund')
  @Permissions('payments.refund')
  refundOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RefundOrderDto,
  ) {
    return this.checkout.refundOrder(user.sub, id, dto);
  }
}

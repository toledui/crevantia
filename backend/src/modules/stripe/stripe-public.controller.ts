import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OptionalAccessTokenGuard } from '../../common/optional-access-token.guard';
import type { AuthenticatedUser } from '../../common/auth.types';
import { CurrentUser } from '../../common/current-user.decorator';
import { CreateStripeCheckoutSessionDto } from './stripe.dto';
import { StripeService } from './stripe.service';

@Controller()
export class StripePublicController {
  constructor(private readonly stripeService: StripeService) {}

  @Get('pricing/stripe/config')
  getPublicConfig() {
    return this.stripeService.getPublicConfig();
  }

  @Post('pricing/checkout/stripe-session')
  @UseGuards(OptionalAccessTokenGuard)
  createCheckoutSession(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: CreateStripeCheckoutSessionDto,
  ) {
    return this.stripeService.createCheckoutSession(user, dto);
  }

  @Post('pricing/checkout/orders/:orderId/resume-stripe')
  @UseGuards(OptionalAccessTokenGuard)
  resumeCheckoutSession(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('orderId') orderId: string,
  ) {
    return this.stripeService.resumeCheckoutSession(user, orderId);
  }

  @Get('pricing/checkout/stripe-verify')
  verifySession(@Query('sessionId') sessionId: string) {
    return this.stripeService.verifySession(sessionId);
  }

  @Post('webhooks/stripe')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    return this.stripeService.handleWebhook(signature, req.rawBody);
  }
}

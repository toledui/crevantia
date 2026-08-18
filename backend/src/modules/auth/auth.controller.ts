import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AccessTokenGuard } from '../../common/access-token.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth.types';
import { AuthService } from './auth.service';
import { ChangePasswordDto, CheckoutRegisterDto, EmailDto, LoginDto, RegisterDto, ResetPasswordDto, TokenDto, UpdateProfileDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}

  @Get('check-email')
  checkEmail(@Query('email') email: string) {
    return this.auth.checkEmail(email || '');
  }

  @Post('checkout-register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async checkoutRegister(
    @Body() dto: CheckoutRegisterDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.checkoutRegister(dto, userAgent);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('register') @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Post('verify-email') verifyEmail(@Body() dto: TokenDto) { return this.auth.verifyEmail(dto); }

  @Post('resend-verification') @Throttle({ default: { limit: 3, ttl: 60_000 } })
  resendVerification(@Body() dto: EmailDto) { return this.auth.resendVerification(dto); }

  @Post('forgot-password') @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: EmailDto) { return this.auth.forgotPassword(dto); }

  @Post('reset-password') resetPassword(@Body() dto: ResetPasswordDto) { return this.auth.resetPassword(dto); }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Headers('user-agent') userAgent: string | undefined, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto, userAgent);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(this.refreshCookie(request));
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(this.refreshCookie(request));
    response.clearCookie('crevantia_refresh', { path: '/api/v1/auth' });
    return { success: true };
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@CurrentUser() user: AuthenticatedUser) { return this.auth.me(user.sub); }

  @Patch('profile')
  @UseGuards(AccessTokenGuard)
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.sub, dto);
  }

  @Post('change-password')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.sub, dto);
  }

  private setRefreshCookie(response: Response, token: string) {
    response.cookie('crevantia_refresh', token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: Number(this.config.get('REFRESH_TOKEN_DAYS') ?? 7) * 86_400_000,
    });
  }

  private refreshCookie(request: Request) {
    const cookies: unknown = request.cookies;
    if (!cookies || typeof cookies !== 'object') return undefined;
    const token = (cookies as Record<string, unknown>).crevantia_refresh;
    return typeof token === 'string' ? token : undefined;
  }
}

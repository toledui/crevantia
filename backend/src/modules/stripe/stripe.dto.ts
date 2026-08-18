import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateStripeSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsIn(['test', 'live'])
  mode!: 'test' | 'live';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  publishableKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  secretKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  webhookSecret?: string;
}

export class TestStripeSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  secretKey?: string;
}

export class CreateStripeCheckoutSessionDto {
  @IsString()
  productSlug!: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerName?: string;
}

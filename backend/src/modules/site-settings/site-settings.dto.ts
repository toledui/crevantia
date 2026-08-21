import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsHexColor, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class ReportCategoryDto {
  @IsString() @MaxLength(80) label!: string;
  @IsString() @MaxLength(2000) description!: string;
  @IsHexColor() color!: string;
}

export class ReportDisplayMappingDto {
  @IsString() @MaxLength(60) targetType!: string;
  @IsString() @MaxLength(120) targetCode!: string;
  @IsString() @MaxLength(180) displayName!: string;
  @IsOptional() @IsString() @MaxLength(180) section?: string;
}

export class ReportTextBlockDto {
  @IsString() @MaxLength(120) key!: string;
  @IsString() @MaxLength(240) title!: string;
  @IsString() @MaxLength(30000) content!: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) sourcePage?: number;
  @IsOptional() @IsString() @MaxLength(240) section?: string;
}

export class UpdateSiteSettingsDto {
  @IsString() @MaxLength(120) siteName!: string;
  @IsString() @MaxLength(500) siteDescription!: string;
  @IsOptional() @IsEmail() @MaxLength(191) contactEmail?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsEmail({}, { each: true }) @MaxLength(191, { each: true }) contactFormRecipientEmails?: string[];
  @IsOptional() @IsIn(['turnstile', 'recaptcha']) contactCaptchaProvider?: 'turnstile' | 'recaptcha';
  @IsOptional() @IsString() @MaxLength(255) contactCaptchaSiteKey?: string;
  @IsOptional() @IsString() @MaxLength(1000) contactCaptchaSecret?: string;
  @IsOptional() @IsString() @MaxLength(60) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(60) contactWhatsapp?: string;
  @IsOptional() @IsString() @MaxLength(500) contactAddress?: string;
  @IsOptional() @IsString() @MaxLength(255) contactHours?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(2000) contactMapUrl?: string;
}

export class SubmitContactFormDto {
  @IsString() @MaxLength(120) name!: string;
  @IsEmail() @MaxLength(191) email!: string;
  @IsOptional() @IsString() @MaxLength(180) subject?: string;
  @IsString() @MaxLength(5000) message!: string;
  @IsOptional() @IsString() @MaxLength(4000) captchaToken?: string;
  @IsOptional() @IsString() @MaxLength(0) website?: string;
}

export class UpdateReportSettingsDto {
  @IsOptional() @IsString() @MaxLength(160) reportBrandName?: string;
  @IsOptional() @IsString() @MaxLength(255) reportPromoTitle?: string;
  @IsOptional() @IsString() @MaxLength(30000) reportPromoText?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(2000) reportPromoUrl?: string;
  @IsOptional() @IsString() @MaxLength(30000) reportIntroduction?: string;
  @IsOptional() @IsString() @MaxLength(30000) reportInterpretation?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReportCategoryDto) reportCategories!: ReportCategoryDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReportDisplayMappingDto) reportDisplayMappings!: ReportDisplayMappingDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReportTextBlockDto) reportTextBlocks!: ReportTextBlockDto[];
}

export class UpdateCustomCodeDto {
  @IsOptional() @IsString() @MaxLength(50000) headCode?: string;
  @IsOptional() @IsString() @MaxLength(100000) bodyEndCode?: string;
}

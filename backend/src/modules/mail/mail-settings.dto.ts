import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateMailSettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsString() @MinLength(1) @MaxLength(255) host!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) port!: number;
  @IsBoolean() secure!: boolean;
  @IsOptional() @IsString() @MaxLength(191) username?: string;
  @IsOptional() @IsString() @MaxLength(500) password?: string;
  @IsString() @MinLength(1) @MaxLength(100) fromName!: string;
  @IsEmail() @MaxLength(191) fromAddress!: string;
}

export class TestMailSettingsDto {
  @IsEmail() @MaxLength(191) email!: string;
  @IsOptional() @IsString() @MaxLength(255) host?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsBoolean() secure?: boolean;
  @IsOptional() @IsString() @MaxLength(191) username?: string;
  @IsOptional() @IsString() @MaxLength(500) password?: string;
  @IsOptional() @IsString() @MaxLength(100) fromName?: string;
  @IsOptional() @IsEmail() @MaxLength(191) fromAddress?: string;
}

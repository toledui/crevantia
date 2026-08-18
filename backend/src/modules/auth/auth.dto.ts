import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PASSWORD_MESSAGE = 'La contraseña debe incluir mayúscula, minúscula y número.';

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(2) @MaxLength(150) lastName!: string;
  @IsEmail() @MaxLength(191) email!: string;
  @IsString() @MinLength(10) @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password!: string;
  @IsBoolean() termsAccepted!: boolean;
  @IsBoolean() privacyAccepted!: boolean;
}

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) password!: string;
}

export class EmailDto {
  @IsEmail() @MaxLength(191) email!: string;
}

export class TokenDto {
  @IsString() @MinLength(32) @MaxLength(500) token!: string;
}

export class ResetPasswordDto extends TokenDto {
  @IsString() @MinLength(10) @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password!: string;
}

export class CheckoutRegisterDto {
  @IsEmail() @MaxLength(191) email!: string;
  @IsString() @MinLength(2) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(2) @MaxLength(150) lastName!: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
}

export class UpdateProfileDto {
  @IsString() @MinLength(2) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(2) @MaxLength(150) lastName!: string;
}

export class ChangePasswordDto {
  @IsString() @MinLength(1) currentPassword!: string;
  @IsString() @MinLength(10) @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}


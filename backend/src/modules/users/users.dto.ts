import { Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ListUsersDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(['ALL', 'ACTIVE', 'PENDING_VERIFICATION', 'DISABLED', 'LOCKED']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}

export class InitialAssignmentDto {
  @IsString() testId!: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() sendEmail?: boolean;
}

export class CreateUserDto {
  @IsString() @MinLength(2) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(2) @MaxLength(150) lastName!: string;
  @IsEmail() @MaxLength(191) email!: string;
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsString({ each: true }) roleIds!: string[];
  @IsOptional() @IsIn(['INVITE_LINK', 'MANUAL_PASSWORD']) passwordMode?: 'INVITE_LINK' | 'MANUAL_PASSWORD';
  @IsOptional() @IsString() @MinLength(8) @MaxLength(100) manualPassword?: string;
  @IsOptional() sendCredentialsEmail?: boolean;
  @IsOptional() initialAssignment?: InitialAssignmentDto;
}

export class UpdateUserDto {
  @IsString() @MinLength(2) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(2) @MaxLength(150) lastName!: string;
  @IsEmail() @MaxLength(191) email!: string;
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsString({ each: true }) roleIds!: string[];
}

export class ChangeUserStatusDto {
  @IsIn(['ACTIVE', 'DISABLED']) status!: 'ACTIVE' | 'DISABLED';
}

export class CreateUserAssignmentDto {
  @IsString() testId!: string;
  @IsOptional() @IsString() testVersionId?: string;
  @IsOptional() @IsIn(['ADMIN_FREE', 'PURCHASE', 'PROMOTIONAL', 'SUPPORT_REPLACEMENT']) type?: 'ADMIN_FREE' | 'PURCHASE' | 'PROMOTIONAL' | 'SUPPORT_REPLACEMENT';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsOptional() sendEmail?: boolean;
  @IsOptional() @IsString() @MaxLength(500) customMessage?: string;
}

import { Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ListUsersDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(['ALL', 'ACTIVE', 'PENDING_VERIFICATION', 'DISABLED', 'LOCKED']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}

export class CreateUserDto {
  @IsString() @MinLength(2) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(2) @MaxLength(150) lastName!: string;
  @IsEmail() @MaxLength(191) email!: string;
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsString({ each: true }) roleIds!: string[];
}

export class UpdateUserDto extends CreateUserDto {}

export class ChangeUserStatusDto {
  @IsIn(['ACTIVE', 'DISABLED']) status!: 'ACTIVE' | 'DISABLED';
}

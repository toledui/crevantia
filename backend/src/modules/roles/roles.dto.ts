import { ArrayUnique, IsArray, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString() @MinLength(2) @MaxLength(50) @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'El código debe usar mayúsculas, números y guiones bajos.' }) code!: string;
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
  @IsArray() @ArrayUnique() @IsString({ each: true }) permissionIds!: string[];
}

export class UpdateRoleDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
  @IsArray() @ArrayUnique() @IsString({ each: true }) permissionIds!: string[];
}

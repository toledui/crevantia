import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuestionType } from '../../generated/prisma/client';

export class CreateTestDto {
  @IsString() @IsNotEmpty() @MaxLength(50) @Matches(/^[A-Za-z0-9_-]+$/) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
}

export class UpdateTestDto {
  @IsString() @IsNotEmpty() @MaxLength(100) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsBoolean() isActive!: boolean;
}

export class CreateVersionDto {
  @IsOptional() @IsString() @MaxLength(10) language = 'es-MX';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(600) estimatedMin?: number;
  @IsOptional() @IsString() cloneFromVersionId?: string;
}

export class StatementInputDto {
  @IsString() @IsNotEmpty() @MaxLength(80) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(10000) text!: string;
  @Type(() => Number) @IsInt() @Min(1) order!: number;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

export class AnswerOptionInputDto {
  @IsString() @IsNotEmpty() @MaxLength(100) value!: string;
  @IsString() @IsNotEmpty() @MaxLength(255) label!: string;
  @Type(() => Number) @IsInt() @Min(1) order!: number;
}

export class QuestionInputDto {
  @IsString() @IsNotEmpty() @MaxLength(80) code!: string;
  @IsEnum(QuestionType) type!: QuestionType;
  @IsString() @IsNotEmpty() @MaxLength(10000) prompt!: string;
  @IsOptional() @IsString() @MaxLength(5000) helpText?: string;
  @Type(() => Number) @IsInt() @Min(1) order!: number;
  @IsBoolean() required!: boolean;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => StatementInputDto) statements: StatementInputDto[] = [];
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => AnswerOptionInputDto) answerOptions: AnswerOptionInputDto[] = [];
}

export class SectionInputDto {
  @IsString() @IsNotEmpty() @MaxLength(50) @Matches(/^[A-Za-z0-9_-]+$/) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(180) title!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(10000) instructions?: string;
  @Type(() => Number) @IsInt() @Min(1) order!: number;
  @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => QuestionInputDto) questions!: QuestionInputDto[];
}

export class ReplaceVersionContentDto {
  @IsString() @IsNotEmpty() @MaxLength(10) language!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(600) estimatedMin?: number;
  @IsOptional() @IsObject() labels?: Record<string, unknown>;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => SectionInputDto) sections!: SectionInputDto[];
}

import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { NormTargetType } from "../../generated/prisma/client";

export class UpdateNormVersionDto {
  @IsString() @IsNotEmpty() @MaxLength(180) name!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(255) populationLabel?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) sampleSize?: number;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(100) ageRange?: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;
}

export class UpdateNormTargetDto {
  @IsString() @IsNotEmpty() @MaxLength(180) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) status!: string;
  @IsBoolean() isBlocked!: boolean;
  @IsOptional() @IsString() @MaxLength(10000) validationNotes?: string;
}

export class CreateNormTargetDto extends UpdateNormTargetDto {
  @IsEnum(NormTargetType) targetType!: NormTargetType;
  @IsString() @IsNotEmpty() @MaxLength(100) targetCode!: string;
}

export class ThresholdDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10) decile!: number;
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  lowerBound!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(10) ordinal!: number;
}

export class ReplaceThresholdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ThresholdDto)
  thresholds!: ThresholdDto[];
}

export class ImpactPreviewDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5000) limit = 1000;
}

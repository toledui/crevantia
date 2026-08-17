import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  ScoringPolarity,
  ScoringSpecificationStatus,
} from "../../generated/prisma/client";

const CODE = /^[A-Za-z0-9_-]+$/;

export class CreateAssessmentDto {
  @IsString() @IsNotEmpty() @MaxLength(80) @Matches(CODE) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(180) name!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
}

export class UpdateAssessmentDto {
  @IsString() @IsNotEmpty() @MaxLength(180) name!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsBoolean() isActive!: boolean;
}

export class CloneAssessmentVersionDto {
  @IsOptional() @IsString() sourceVersionId?: string;
  @IsOptional() @IsString() @MaxLength(10) language?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  estimatedMinutes?: number;
}

export class DemographicFieldAdminDto {
  @IsString() @IsNotEmpty() @MaxLength(80) @Matches(CODE) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) @Matches(CODE) fieldKey!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) label!: string;
  @IsString() @IsNotEmpty() @MaxLength(50) type!: string;
  @Type(() => Number) @IsInt() @Min(1) order!: number;
  @IsBoolean() required!: boolean;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

export class ReactiveScoringAdminDto {
  @IsString() @IsNotEmpty() @MaxLength(80) @Matches(CODE) scaleCode!: string;
  @IsIn(Object.values(ScoringPolarity)) polarity!: ScoringPolarity;
  @Type(() => Number) @IsNumber() fixedWeight!: number;
  @Type(() => Number) @IsNumber() scoreIfMore!: number;
  @Type(() => Number) @IsNumber() scoreIfLess!: number;
}

export class ReactiveAdminDto {
  @IsString() @IsNotEmpty() @MaxLength(80) @Matches(CODE) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(10000) text!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(2) position!: number;
  @IsOptional()
  @ValidateNested()
  @Type(() => ReactiveScoringAdminDto)
  scoring?: ReactiveScoringAdminDto;
}

export class LikertOptionAdminDto {
  @Type(() => Number) @IsInt() value!: number;
  @IsString() @IsNotEmpty() @MaxLength(255) label!: string;
  @Type(() => Number) @IsInt() @Min(1) order!: number;
}

export class AssessmentQuestionAdminDto {
  @IsIn(["PAIR", "LIKERT"]) type!: "PAIR" | "LIKERT";
  @IsString() @IsNotEmpty() @MaxLength(80) @Matches(CODE) code!: string;
  @Type(() => Number) @IsInt() @Min(1) order!: number;
  @IsBoolean() required!: boolean;
  @IsOptional() @IsString() @MaxLength(10000) text?: string;
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(CODE)
  optionSetCode?: string;
  @IsOptional()
  @IsIn(Object.values(ScoringSpecificationStatus))
  scoringStatus?: ScoringSpecificationStatus;
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ReactiveAdminDto)
  reactives: ReactiveAdminDto[] = [];
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => LikertOptionAdminDto)
  options: LikertOptionAdminDto[] = [];
}

export class AssessmentSectionAdminDto {
  @IsString() @IsNotEmpty() @MaxLength(80) @Matches(CODE) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(180) name!: string;
  @IsOptional() @IsString() @MaxLength(10000) instructions?: string;
  @Type(() => Number) @IsInt() @Min(1) order!: number;
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => AssessmentQuestionAdminDto)
  questions!: AssessmentQuestionAdminDto[];
}

export class ReplaceAssessmentContentDto {
  @IsString() @IsNotEmpty() expectedUpdatedAt!: string;
  @IsString() @IsNotEmpty() @MaxLength(10) language!: string;
  @IsOptional() @IsString() @MaxLength(10000) intro?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  estimatedMinutes?: number;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DemographicFieldAdminDto)
  demographics!: DemographicFieldAdminDto[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AssessmentSectionAdminDto)
  sections!: AssessmentSectionAdminDto[];
}

import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReportTemplateDto {
  @IsString() @MaxLength(80) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() testId!: string;
  @IsOptional() @IsString() assessmentId?: string;
  @IsOptional() @IsString() themeId?: string;
  @IsOptional() @IsString() cloneFromVersionId?: string;
  @IsOptional() @IsIn(['LETTER', 'A4']) pageSize?: 'LETTER' | 'A4';
  @IsOptional() @IsString() @MaxLength(10) language?: string;
  @IsOptional() @IsString() @MaxLength(40) audience?: string;
}

export class UpdateTemplateLinkDto {
  @IsString() testId!: string;
  @IsOptional() @IsString() assessmentId?: string;
  @IsOptional() @IsString() @MaxLength(10) language?: string;
  @IsOptional() @IsString() @MaxLength(40) audience?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateReportVersionDto {
  @IsOptional() @IsObject() layoutJson?: Record<string, unknown>;
  @IsOptional() @IsObject() bindingConfigJson?: Record<string, unknown>;
}

export class SaveReportRevisionDto {
  @IsObject() layoutJson!: Record<string, unknown>;
  @IsObject() bindingConfigJson!: Record<string, unknown>;
}

export class UpdateBindingDto {
  @IsString() presetCode!: string;
  @IsString() itemKey!: string;
  @IsString() sourceType!: string;
  @IsString() sourceCode!: string;
}

export class CreateVersionDto {
  @IsString() version!: string;
}

export class GenerateReportDto {
  @IsOptional() @IsString() resultRunId?: string;
  @IsOptional() @IsIn(['LETTER', 'A4']) pageSize?: 'LETTER' | 'A4';
}

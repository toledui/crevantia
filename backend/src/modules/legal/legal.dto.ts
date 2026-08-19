import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateLegalDocumentDto {
  @IsIn(['TERMS_AND_CONDITIONS', 'PRIVACY_POLICY'])
  type!: 'TERMS_AND_CONDITIONS' | 'PRIVACY_POLICY';

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsOptional()
  version?: string;
}

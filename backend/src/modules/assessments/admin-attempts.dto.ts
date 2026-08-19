import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListAdminAttemptsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'CREATED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'ATTENTION_REQUIRED'])
  status?: string = 'ALL';
}

export class AdminAttemptActionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

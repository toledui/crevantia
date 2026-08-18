import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateFinancialSettingsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  currency!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  decimalPlaces!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  taxName!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRatePercent!: number;

  @IsBoolean()
  pricesIncludeTax!: boolean;
}

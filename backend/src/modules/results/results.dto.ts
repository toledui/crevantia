import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class RecalculateResultDto {
  @IsString() @IsNotEmpty() normVersionId!: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) reason!: string;
}

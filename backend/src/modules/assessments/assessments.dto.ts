import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

export class SaveAttemptAnswerDto {
  @IsOptional() @IsString() selectedMoreReactiveId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) value?: number;
  @IsString() @IsNotEmpty() @MaxLength(100) operationId!: string;
  @IsOptional() @IsInt() @Min(1) version?: number;

  @ValidateIf(
    (value: SaveAttemptAnswerDto) =>
      value.selectedMoreReactiveId === undefined && value.value === undefined,
  )
  @IsString({ message: "Debes enviar selectedMoreReactiveId o value." })
  private readonly answerRequired?: string;
}

export class SaveDemographicsDto {
  @IsObject() answers!: Record<string, unknown>;
  @IsString() @IsNotEmpty() @MaxLength(80) operationId!: string;
}

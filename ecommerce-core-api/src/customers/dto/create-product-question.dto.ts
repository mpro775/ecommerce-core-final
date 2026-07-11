import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProductQuestionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  question!: string;
}

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

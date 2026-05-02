import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  job?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  website?: string;

  @IsOptional()
  @IsString()
  img?: string;

  @IsOptional()
  @IsString()
  cover?: string;
}

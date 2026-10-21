import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsImageRef } from '../../common/validators/image-ref';

export class CreateCommunityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  slug: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}

export class UpdateCommunityDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsImageRef()
  img?: string;

  @IsOptional()
  @IsImageRef()
  cover?: string;
}

export class AddRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

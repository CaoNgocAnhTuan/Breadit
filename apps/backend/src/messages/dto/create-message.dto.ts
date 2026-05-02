import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  body?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;
}

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  targetUserId: string;
}

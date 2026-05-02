import { IsEmail } from 'class-validator';

export class ResendVerifyDto {
  @IsEmail()
  email: string;
}

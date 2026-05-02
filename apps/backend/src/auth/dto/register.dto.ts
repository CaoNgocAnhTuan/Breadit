import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString() @MinLength(3) @MaxLength(30) @Matches(/^[a-zA-Z0-9_]+$/)
  username: string;

  @IsEmail()
  email: string;

  @IsString() @MinLength(6)
  password: string;
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerifyDto } from './dto/resend-verify.dto';
import { VerifyDto } from './dto/verify.dto';
import { JwtAuthGuard } from './jwt.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.login(dto, reply);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    return this.auth.logout(reply);
  }

  @Get('me')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: FastifyRequest) {
    const user = (req as unknown as Record<string, unknown>)['user'] as { id: string };
    return this.auth.me(user.id);
  }

  @Post('verify')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  verifyEmail(@Body() dto: VerifyDto) {
    return this.auth.verifyEmail(dto.email, dto.code);
  }

  @Post('verify/resend')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  resendVerification(@Body() dto: ResendVerifyDto) {
    return this.auth.resendVerificationCode(dto.email);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }
}

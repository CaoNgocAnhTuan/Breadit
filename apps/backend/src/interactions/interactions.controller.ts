import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { BannedUserGuard } from '../auth/banned-user.guard';
import { InteractionsService } from './interactions.service';

class RepostDto {
  @IsOptional()
  @IsString()
  desc?: string;
}

type AuthedRequest = FastifyRequest & {
  user?: { id: string; username: string };
};

@Controller('api/posts')
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post(':id/like')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, BannedUserGuard, EmailVerifiedGuard)
  toggleLike(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.interactionsService.toggleLike(req.user!.id, +id);
  }

  @Post(':id/save')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, BannedUserGuard, EmailVerifiedGuard)
  toggleSave(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.interactionsService.toggleSave(req.user!.id, +id);
  }

  @Post(':id/repost')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, BannedUserGuard, EmailVerifiedGuard)
  toggleRepost(
    @Param('id') id: string,
    @Body() body: RepostDto,
    @Req() req: AuthedRequest,
  ) {
    return this.interactionsService.toggleRepost(req.user!.id, +id, body.desc);
  }
}

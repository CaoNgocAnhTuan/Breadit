import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { BannedUserGuard } from '../auth/banned-user.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { CommentsService } from './comments.service';

type AuthedRequest = FastifyRequest & {
  user?: { id: string; username: string };
};

@Controller('api')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('posts/:postId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  findByPost(
    @Param('postId', ParseIntPipe) postId: number,
    @Req() req: AuthedRequest,
  ) {
    return this.commentsService.findByPost(postId, req.user?.id);
  }

  @Post('posts/:postId/comments')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  create(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() body: { body: string; parentCommentId?: number },
    @Req() req: AuthedRequest,
  ) {
    return this.commentsService.create(
      req.user!.id,
      postId,
      body.body,
      body.parentCommentId,
    );
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthedRequest,
  ) {
    return this.commentsService.remove(id, req.user!.id);
  }

  @Post('comments/:id/like')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, BannedUserGuard, EmailVerifiedGuard)
  toggleLike(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthedRequest,
  ) {
    return this.commentsService.toggleLike(req.user!.id, id);
  }
}

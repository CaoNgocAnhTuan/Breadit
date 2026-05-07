import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { HashtagsService } from './hashtags.service';

type AuthedRequest = FastifyRequest & {
  user?: { id: string; username: string };
};

@Controller('api/hashtags')
export class HashtagsController {
  constructor(private readonly hashtagsService: HashtagsService) {}

  @Get('trending')
  getTrending() {
    return this.hashtagsService.getTrending();
  }

  @Get(':tag/posts')
  @UseGuards(OptionalJwtAuthGuard)
  getPostsByTag(
    @Param('tag') tag: string,
    @Query('cursor') cursor = '1',
    @Req() req: AuthedRequest,
  ) {
    return this.hashtagsService.getPostsByTag(tag, Number(cursor), req.user?.id);
  }
}

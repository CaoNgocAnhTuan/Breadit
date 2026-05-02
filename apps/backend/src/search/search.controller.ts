import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { SearchService } from './search.service';

type AuthedRequest = FastifyRequest & {
  user?: { id: string; username: string };
};

@Controller('api/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  search(@Query('q') q = '', @Req() req: AuthedRequest) {
    return this.searchService.search(q, req.user?.id);
  }
}

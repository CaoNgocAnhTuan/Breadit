import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotificationsService } from './notifications.service';

type AuthedRequest = FastifyRequest & { user?: { id: string; username: string } };

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Req() req: AuthedRequest,
    @Query('cursor') cursor: string,
    @Query('unread') unread: string,
  ) {
    return this.notificationsService.findAll(
      req.user!.id,
      parseInt(cursor ?? '1', 10),
      unread === 'true',
    );
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  markAllRead(@Req() req: AuthedRequest) {
    return this.notificationsService.markAllRead(req.user!.id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  markRead(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.notificationsService.markRead(req.user!.id, +id);
  }
}

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotificationsService } from './notifications.service';
import { Cursor } from '../common/decorators/cursor.decorator';

type AuthedRequest = FastifyRequest & { user?: { id: string; username: string } };

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Req() req: AuthedRequest,
    @Cursor(1) cursor: number,
    @Query('unread') unread: string,
  ) {
    return this.notificationsService.findAll(
      req.user!.id,
      cursor,
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
  markRead(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.notificationsService.markRead(req.user!.id, id);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateConversationDto, CreateMessageDto } from './dto/create-message.dto';
import { MessagesService } from './messages.service';

type AuthedRequest = FastifyRequest & {
  user?: { id: string; username: string };
};

@Controller('api/conversations')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  getConversations(
    @Req() req: AuthedRequest,
    @Query('cursor') cursor?: string,
  ) {
    return this.messagesService.getConversations(
      req.user!.id,
      cursor ? parseInt(cursor, 10) : undefined,
    );
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: AuthedRequest) {
    return this.messagesService.getUnreadCount(req.user!.id);
  }

  @Post()
  @UseGuards(EmailVerifiedGuard)
  findOrCreate(
    @Req() req: AuthedRequest,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagesService.findOrCreateConversation(req.user!.id, dto);
  }

  @Get(':id')
  getConversationById(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.messagesService.getConversationById(id, req.user!.id);
  }

  @Get(':id/messages')
  getMessages(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.messagesService.getMessages(
      id,
      req.user!.id,
      cursor ? parseInt(cursor, 10) : undefined,
    );
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EmailVerifiedGuard)
  sendMessage(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.sendMessage(id, req.user!.id, dto);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.messagesService.markRead(id, req.user!.id);
  }
}

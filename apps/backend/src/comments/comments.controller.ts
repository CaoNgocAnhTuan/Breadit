import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
  ParseIntPipe,
  Post,
  PayloadTooLargeException,
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
import type { BufferedFile } from '../uploads/uploads.service';

type AuthedRequest = FastifyRequest & {
  user?: { id: string; username: string };
};

function mapMultipartUploadError(err: unknown): { status: 'payload_too_large' | 'bad_request'; message: string } {
  const e = err as { code?: string; message?: string };
  const code = e?.code;
  const message = String(e?.message ?? '');

  if (code === 'FST_REQ_FILE_TOO_LARGE') {
    return { status: 'payload_too_large', message: 'File exceeds 500 MB limit' };
  }

  if (code === 'FST_REQ_FILES_LIMIT' || /files limit/i.test(message)) {
    return { status: 'bad_request', message: 'Too many files (max 10).' };
  }

  return { status: 'bad_request', message: `Malformed upload: ${message}` };
}

@Controller('api')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('posts/:postId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  findByPost(
    @Param('postId', ParseIntPipe) postId: number,
    @Query('sort') sort: string = 'relevant',
    @Req() req: AuthedRequest,
  ) {
    return this.commentsService.findByPost(postId, req.user?.id, sort);
  }

  @Post('posts/:postId/comments')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async create(
    @Param('postId', ParseIntPipe) postId: number,
    @Req() req: FastifyRequest & { user?: { id: string; username: string } },
  ) {
    const body: { body?: string; parentCommentId?: number } = {};
    const bufferedFiles: BufferedFile[] = [];

    try {
      for await (const part of req.parts()) {
        if (part.type === 'field') {
          const val = part.value as string;
          if (part.fieldname === 'body') body.body = val;
          else if (part.fieldname === 'parentCommentId') {
            const n = parseInt(val, 10);
            if (!isNaN(n)) body.parentCommentId = n;
          }
        } else if (part.type === 'file') {
          const buffer = await part.toBuffer();
          bufferedFiles.push({
            buffer,
            mimetype: part.mimetype,
            filename: part.filename,
          });
        }
      }
    } catch (err) {
      const mapped = mapMultipartUploadError(err);
      if (mapped.status === 'payload_too_large') throw new PayloadTooLargeException(mapped.message);
      throw new BadRequestException(mapped.message);
    }

    if (body.body == null) throw new BadRequestException('Missing body');

    return this.commentsService.create(
      req.user!.id,
      postId,
      body.body,
      body.parentCommentId,
      bufferedFiles,
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

  @Patch('comments/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, BannedUserGuard, EmailVerifiedGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest & { user?: { id: string; username: string } },
  ) {
    const body: { body?: string; mediaIdsToRemove?: number[] } = {};
    const bufferedFiles: BufferedFile[] = [];

    try {
      for await (const part of req.parts()) {
        if (part.type === 'field') {
          const val = part.value as string;
          if (part.fieldname === 'body') body.body = val;
          else if (part.fieldname === 'mediaIdsToRemove') {
            const parsed = JSON.parse(val) as unknown;
            if (Array.isArray(parsed)) {
              body.mediaIdsToRemove = parsed
                .map((x) => (typeof x === 'string' ? parseInt(x, 10) : x))
                .filter((n) => typeof n === 'number' && !isNaN(n));
            }
          }
        } else if (part.type === 'file') {
          const buffer = await part.toBuffer();
          bufferedFiles.push({
            buffer,
            mimetype: part.mimetype,
            filename: part.filename,
          });
        }
      }
    } catch (err) {
      const mapped = mapMultipartUploadError(err);
      if (mapped.status === 'payload_too_large') throw new PayloadTooLargeException(mapped.message);
      throw new BadRequestException(mapped.message);
    }

    return this.commentsService.update(id, req.user!.id, body, bufferedFiles);
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

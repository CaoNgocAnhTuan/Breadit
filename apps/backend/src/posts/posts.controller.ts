import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Param,
  ParseIntPipe,
  PayloadTooLargeException,
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
import { PostsService } from './posts.service';

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

  // Fastify multipart: files limit exceeded
  if (code === 'FST_REQ_FILES_LIMIT' || /files limit/i.test(message)) {
    return { status: 'bad_request', message: 'Too many files (max 10).' };
  }

  return { status: 'bad_request', message: `Malformed upload: ${message}` };
}

@Controller('api/posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(
    @Query('cursor') cursor = '1',
    @Query('user') user: string | undefined,
    @Query('feed') feed: string | undefined,
    @Query('communityId') communityId: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    return this.postsService.findAll(
      cursor,
      user,
      req.user?.id,
      feed,
      communityId ? Number(communityId) : undefined,
    );
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req: AuthedRequest) {
    const post = await this.postsService.findOne(Number(id), req.user?.id);
    if (!post) throw new NotFoundException();
    return post;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async create(@Req() req: FastifyRequest & { user?: { id: string } }) {
    const body: {
      desc?: string;
      imgType?: string;
      rePostId?: number;
      isSensitive?: boolean;
      communityId?: number;
    } = {};
    const bufferedFiles: { buffer: Buffer; mimetype: string; filename: string }[] = [];

    try {
      for await (const part of req.parts()) {
        if (part.type === 'field') {
          const val = part.value as string;
          if (part.fieldname === 'desc') body.desc = val;
          else if (part.fieldname === 'imgType') body.imgType = val;
          else if (part.fieldname === 'rePostId') {
            const n = parseInt(val, 10);
            if (!isNaN(n)) body.rePostId = n;
          } else if (part.fieldname === 'communityId') {
            const n = parseInt(val, 10);
            if (!isNaN(n)) body.communityId = n;
          } else if (part.fieldname === 'isSensitive') {
            body.isSensitive = val === 'true';
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

    return this.postsService.create(req.user!.id, body, bufferedFiles);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, BannedUserGuard, EmailVerifiedGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest & { user?: { id: string } },
  ) {
    const body: { desc?: string; mediaIdsToRemove?: number[] } = {};
    const bufferedFiles: { buffer: Buffer; mimetype: string; filename: string }[] = [];

    try {
      for await (const part of req.parts()) {
        if (part.type === 'field') {
          const val = part.value as string;
          if (part.fieldname === 'desc') body.desc = val;
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

    return this.postsService.update(id, req.user!.id, body, bufferedFiles);
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  createReport(
    @Param('id', ParseIntPipe) postId: number,
    @Body() body: { reason: string },
    @Req() req: AuthedRequest,
  ) {
    return this.postsService.createReport(req.user!.id, postId, body.reason);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.postsService.remove(+id, req.user!.id);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
      Number(cursor),
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
      parentPostId?: number;
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
          } else if (part.fieldname === 'parentPostId') {
            const n = parseInt(val, 10);
            if (!isNaN(n)) body.parentPostId = n;
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
      const code = (err as { code?: string }).code;
      if (code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new PayloadTooLargeException('File exceeds 500 MB limit');
      }
      throw new BadRequestException(`Malformed upload: ${(err as Error).message}`);
    }

    return this.postsService.create(req.user!.id, body, bufferedFiles);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async createComment(@Param('id') id: string, @Req() req: FastifyRequest & { user?: { id: string } }) {
    const body: { desc?: string; imgType?: string } = {};
    const bufferedFiles: { buffer: Buffer; mimetype: string; filename: string }[] = [];

    try {
      for await (const part of req.parts()) {
        if (part.type === 'field') {
          const val = part.value as string;
          if (part.fieldname === 'desc') body.desc = val;
          else if (part.fieldname === 'imgType') body.imgType = val;
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
      const code = (err as { code?: string }).code;
      if (code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new PayloadTooLargeException('File exceeds 500 MB limit');
      }
      throw new BadRequestException(`Malformed upload: ${(err as Error).message}`);
    }

    return this.postsService.create(
      req.user!.id,
      { ...body, parentPostId: +id },
      bufferedFiles,
    );
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

import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  PayloadTooLargeException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { UploadsService, type BufferedFile } from './uploads.service';

@Controller('api/uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async upload(@Req() req: FastifyRequest) {
    let imgType: string | undefined;
    let bufferedFile: BufferedFile | undefined;

    try {
      for await (const part of req.parts()) {
        if (part.type === 'field' && part.fieldname === 'imgType') {
          imgType = part.value as string;
        } else if (part.type === 'file') {
          const buffer = await part.toBuffer();
          bufferedFile = {
            buffer,
            mimetype: part.mimetype,
            filename: part.filename,
          };
        }
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new PayloadTooLargeException('File exceeds 500 MB limit');
      }
      throw new BadRequestException(
        `Malformed upload: ${(err as Error).message}`,
      );
    }

    if (!bufferedFile) throw new BadRequestException('No file attached');

    const filename = await this.uploadsService.saveFile(bufferedFile, imgType);
    return { filename };
  }
}

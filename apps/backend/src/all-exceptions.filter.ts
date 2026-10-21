import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Database errors that mean "the client sent something wrong", not "the server broke".
 * Without this map they all became 500 (finding T7, B3).
 */
function fromPrisma(exception: unknown): { status: number; message: string } | null {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2025': // record to update or delete not found
        return { status: HttpStatus.NOT_FOUND, message: 'Not found' };
      case 'P2003': // foreign key: the referenced record does not exist
        return { status: HttpStatus.NOT_FOUND, message: 'Referenced record not found' };
      case 'P2002': // unique constraint
        return { status: HttpStatus.CONFLICT, message: 'Already exists' };
      case 'P2000': // value too long for the column
        return { status: HttpStatus.BAD_REQUEST, message: 'Value too long' };
      default:
        return null;
    }
  }
  if (exception instanceof Prisma.PrismaClientValidationError) {
    return { status: HttpStatus.BAD_REQUEST, message: 'Invalid request data' };
  }
  return null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<FastifyRequest>();

    const isHttp = exception instanceof HttpException;
    const mapped = isHttp ? null : fromPrisma(exception);
    const status = isHttp
      ? exception.getStatus()
      : (mapped?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const payload = isHttp
      ? exception.getResponse()
      : mapped
        ? { statusCode: status, message: mapped.message }
        : { statusCode: status, message: 'Internal server error' };

    if (mapped) {
      const err = exception as Error & { code?: string };
      this.logger.warn(`${req.method} ${req.url} -> ${status} | prisma ${err?.code ?? 'validation'}`);
    } else if (!isHttp || status >= 500) {
      const err = exception as Error & { code?: string };
      this.logger.error(
        `${req.method} ${req.url} -> ${status} | ${err?.name ?? 'Error'}: ${err?.message ?? exception} | code=${err?.code ?? 'n/a'}`,
        err?.stack,
      );
    }

    res.status(status).send(typeof payload === 'string' ? { message: payload } : payload);
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<FastifyRequest>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = isHttp
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    if (!isHttp || status >= 500) {
      const err = exception as Error & { code?: string };
      this.logger.error(
        `${req.method} ${req.url} -> ${status} | ${err?.name ?? 'Error'}: ${err?.message ?? exception} | code=${err?.code ?? 'n/a'}`,
        err?.stack,
      );
    }

    res.status(status).send(typeof payload === 'string' ? { message: payload } : payload);
  }
}

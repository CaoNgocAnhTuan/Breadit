import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { parseCursor } from '../parse-cursor';

/**
 * Reads `?cursor=` as a whole number of 1 or more (400 otherwise).
 * `@Cursor(1) cursor: number` defaults to page 1. `@Cursor() cursor?: number` has no default.
 *
 * This is a custom decorator on purpose. A `@Query('cursor', pipe) cursor: number` parameter
 * is converted by the global ValidationPipe first, so a missing cursor would arrive as NaN.
 */
export const Cursor = createParamDecorator((fallback: number | undefined, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<FastifyRequest>();
  const raw = (req.query as Record<string, unknown> | undefined)?.cursor;
  return parseCursor(raw, fallback);
});

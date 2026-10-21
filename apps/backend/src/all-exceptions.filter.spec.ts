import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const send = jest.fn();
  const status = jest.fn().mockReturnValue({ send });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/x' }),
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { status: status.mock.calls[0][0] as number, body: send.mock.calls[0][0] };
}

const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db says no', { code, clientVersion: 'test' });

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['P2025 (record not found)', 'P2025', 404],
    ['P2003 (foreign key: referenced record missing)', 'P2003', 404],
    ['P2002 (unique constraint)', 'P2002', 409],
    ['P2000 (value too long for the column)', 'P2000', 400],
  ])('T7/B3: maps Prisma %s to HTTP %i', (_label, code, expected) => {
    const { status, body } = run(known(code));
    expect(status).toBe(expected);
    expect(body.statusCode).toBe(expected);
    expect(typeof body.message).toBe('string');
  });

  it('T7: maps a Prisma validation error to 400', () => {
    const err = new Prisma.PrismaClientValidationError('bad argument', { clientVersion: 'test' });
    expect(run(err).status).toBe(400);
  });

  it('does not leak database details in the message', () => {
    const { body } = run(known('P2003'));
    expect(JSON.stringify(body)).not.toContain('db says no');
  });

  it('keeps an unknown Prisma code as 500', () => {
    const { status, body } = run(known('P2034'));
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
  });

  it('passes HttpException through unchanged', () => {
    const { status, body } = run(new BadRequestException('nope'));
    expect(status).toBe(400);
    expect(body.message).toBe('nope');
  });

  it('turns any other error into 500 with a generic message', () => {
    const { status, body } = run(new Error('secret stack detail'));
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
  });
});

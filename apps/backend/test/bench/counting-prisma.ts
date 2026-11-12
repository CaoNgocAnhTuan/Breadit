import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';

/** The connection pool of Prisma sends this itself to test a connection it hands out. The app never sends it. */
const POOL_PING_SQL = 'SELECT 1';

/**
 * `PrismaService` that counts the SQL statements Prisma sends (E7, design: Code files). It is used only by the bench
 * spec, through `createTestApp([{ provide: PrismaService, useClass: CountingPrisma }])`, so `src/` has no counting code.
 *
 * Every statement of the app counts, also BEGIN and COMMIT of a transaction. The pool pings (`SELECT 1`) do not: they
 * come and go with the age of the connections, and without this rule two passes over the same requests gave counts
 * that differed by 1 to 3 (F8). The bench sends one request at a time, so the statements between `reset()` and the
 * end of the response all belong to that request.
 */
@Injectable()
export class CountingPrisma extends PrismaService {
  private queries = 0;

  constructor() {
    super({ log: [{ emit: 'event', level: 'query' }] });
    // The typed `$on('query')` exists only on a client built with the log option, hence the cast.
    (this as unknown as { $on(event: 'query', cb: (e: { query: string }) => void): void }).$on('query', (e) => {
      if (e.query === POOL_PING_SQL) return;
      this.queries += 1;
    });
  }

  reset(): void {
    this.queries = 0;
  }

  count(): number {
    return this.queries;
  }
}

import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from '../redis/redis.service';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisService) {}

  private readonly httpCacheEnabled = (process.env.REDIS_HTTP_CACHE_ENABLED ?? 'true') === 'true';
  private readonly stats = new Map<
    string,
    { hits: number; misses: number; sets: number; lastHitAt?: number; lastMissAt?: number }
  >();

  private record(prefix: string, hit: boolean) {
    if (!this.httpCacheEnabled) return;
    const current = this.stats.get(prefix) ?? { hits: 0, misses: 0, sets: 0 };
    if (hit) current.hits += 1;
    else current.misses += 1;
    if (hit) current.lastHitAt = Date.now();
    else current.lastMissAt = Date.now();
    this.stats.set(prefix, current);
  }

  private buildKey(prefix: string, parts: Array<string | number | boolean | null | undefined>) {
    // Keep keys deterministic and avoid accidental "undefined" string segments.
    const normalized = parts
      .filter((p): p is string | number | boolean => p !== undefined && p !== null)
      .map((p) => String(p));

    return [prefix, ...normalized].join(':');
  }

  async getJson<T>(prefix: string, parts: Array<string | number | boolean | null | undefined>): Promise<T | null> {
    if (!this.httpCacheEnabled) return null;
    const key = this.buildKey(prefix, parts);
    const raw = await this.redis.get(key);
    if (!raw) {
      this.record(prefix, false);
      return null;
    }

    this.record(prefix, true);

    return JSON.parse(raw) as T;
  }

  async setJson<T>(
    prefix: string,
    parts: Array<string | number | boolean | null | undefined>,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    if (!this.httpCacheEnabled) return;
    const key = this.buildKey(prefix, parts);
    const json = JSON.stringify(value as unknown as JsonValue);

    if (ttlSeconds && ttlSeconds > 0) {
      await this.redis.set(key, json, 'EX', ttlSeconds);
      const current = this.stats.get(prefix) ?? { hits: 0, misses: 0, sets: 0 };
      current.sets += 1;
      this.stats.set(prefix, current);
      return;
    }

    await this.redis.set(key, json);
    const current = this.stats.get(prefix) ?? { hits: 0, misses: 0, sets: 0 };
    current.sets += 1;
    this.stats.set(prefix, current);
  }

  async del(prefix: string, parts: Array<string | number | boolean | null | undefined>): Promise<void> {
    if (!this.httpCacheEnabled) return;
    const key = this.buildKey(prefix, parts);
    await this.redis.del(key);
  }

  getCacheStats() {
    const out: Record<string, { hits: number; misses: number; sets: number }> = {};
    for (const [prefix, v] of this.stats.entries()) {
      out[prefix] = { hits: v.hits, misses: v.misses, sets: v.sets };
    }
    return {
      enabled: this.httpCacheEnabled,
      prefixes: out,
    };
  }

  async getNumber(
    prefix: string,
    parts: Array<string | number | boolean | null | undefined>,
    defaultValue = 0,
  ): Promise<number> {
    const key = this.buildKey(prefix, parts);
    const raw = await this.redis.get(key);
    if (!raw) return defaultValue;
    const n = Number(raw);
    return Number.isFinite(n) ? n : defaultValue;
  }

  async incrNumber(
    prefix: string,
    parts: Array<string | number | boolean | null | undefined>,
    by = 1,
  ): Promise<number> {
    const key = this.buildKey(prefix, parts);
    const result = await (this.redis as any).incrby(key, by);
    return typeof result === 'number' ? result : Number(result);
  }

  /**
   * Cache read with a simple Redis lock to reduce stampede.
   * Correctness: still eventual (TTL-based). Used for read-heavy endpoints only.
   */
  async getOrSetJson<T>(
    prefix: string,
    parts: Array<string | number | boolean | null | undefined>,
    ttlSeconds: number,
    loader: () => Promise<T>,
    lockTtlSeconds = 5,
  ): Promise<T> {
    if (!this.httpCacheEnabled) return loader();
    const key = this.buildKey(prefix, parts);

    const existing = await this.redis.get(key);
    if (existing) return JSON.parse(existing) as T;

    const lockKey = `${key}:lock`;
    const lockValue = String(Date.now()) + ':' + Math.random().toString(16).slice(2);
    // ioredis typing của project này không khớp đầy đủ với overload 'NX'/'EX',
    // nên cast `any` để vẫn dùng đúng hành vi Redis.
    const lockSet = await (this.redis as any).set(lockKey, lockValue, 'NX', 'EX', lockTtlSeconds);

    if (lockSet) {
      try {
        const loaded = await loader();
        const json = JSON.stringify(loaded as unknown as JsonValue);
        await this.redis.set(key, json, 'EX', ttlSeconds);
        return loaded;
      } finally {
        // Best-effort unlock; safe enough for TTL-based cache.
        await this.redis.del(lockKey);
      }
    }

    // Someone else is loading; wait briefly for the cache to appear.
    for (let i = 0; i < 25; i++) {
      const retryRaw = await this.redis.get(key);
      if (retryRaw) return JSON.parse(retryRaw) as T;
      await new Promise((r) => setTimeout(r, 50));
    }

    // Last resort: return fresh data even if we lost the race.
    return loader();
  }
}


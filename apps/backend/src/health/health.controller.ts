import { Controller, Get } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

@Controller('api/health')
export class HealthController {
  constructor(private readonly cache: CacheService) {}

  @Get()
  check() {
    return { status: 'ok', cache: this.cache.getCacheStats() };
  }
}

import { Module } from '@nestjs/common';
import { BlockService } from './block.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [BlockService],
  exports: [BlockService],
})
export class BlockModule {}

import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { BlockModule } from '../block/block.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [BlockModule, CacheModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}

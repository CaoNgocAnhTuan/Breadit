import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { HashtagsController } from './hashtags.controller';
import { HashtagsService } from './hashtags.service';

@Module({
  imports: [CacheModule],
  controllers: [HashtagsController],
  providers: [HashtagsService],
})
export class HashtagsModule {}

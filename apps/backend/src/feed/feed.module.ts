import { Module } from '@nestjs/common';
import { BlockModule } from '../block/block.module';
import { FEED_CONFIG, readFeedConfig } from './feed.config';
import { FeedService } from './feed.service';

@Module({
  imports: [BlockModule],
  providers: [FeedService, { provide: FEED_CONFIG, useFactory: () => readFeedConfig(process.env) }],
  exports: [FeedService, FEED_CONFIG],
})
export class FeedModule {}

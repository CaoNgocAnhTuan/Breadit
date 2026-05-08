import { Module } from '@nestjs/common';
import { BlockModule } from '../block/block.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CacheModule } from '../cache/cache.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [BlockModule, NotificationsModule, CacheModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}

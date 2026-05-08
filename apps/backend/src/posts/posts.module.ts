import { Module } from '@nestjs/common';
import { BlockModule } from '../block/block.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CacheModule } from '../cache/cache.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [BlockModule, UploadsModule, NotificationsModule, CacheModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}

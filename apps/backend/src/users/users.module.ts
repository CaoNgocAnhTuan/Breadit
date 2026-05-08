import { Module } from '@nestjs/common';
import { BlockModule } from '../block/block.module';
import { CacheModule } from '../cache/cache.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [BlockModule, CacheModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { AuthModule } from './auth/auth.module';
import { CommunitiesModule } from './communities/communities.module';
import { HashtagsModule } from './hashtags/hashtags.module';
import { HealthModule } from './health/health.module';
import { InteractionsModule } from './interactions/interactions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MessagesModule } from './messages/messages.module';
import { SearchModule } from './search/search.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { CommentsModule } from './comments/comments.module';
import { CacheModule } from './cache/cache.module';
import Redis from 'ioredis';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 120 }],
      storage: new ThrottlerStorageRedisService(
        new Redis(process.env.REDIS_URL ?? 'redis://redis:6379'),
      ),
    }),
    PrismaModule,
    RedisModule,
    CacheModule,
    AuthModule,
    HealthModule,
    PostsModule,
    UploadsModule,
    UsersModule,
    InteractionsModule,
    NotificationsModule,
    HashtagsModule,
    SearchModule,
    MessagesModule,
    CommunitiesModule,
    AdminModule,
    CommentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

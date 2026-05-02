import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    RedisModule,
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
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

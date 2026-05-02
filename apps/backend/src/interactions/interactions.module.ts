import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';

@Module({
  imports: [NotificationsModule],
  controllers: [InteractionsController],
  providers: [InteractionsService],
})
export class InteractionsModule {}

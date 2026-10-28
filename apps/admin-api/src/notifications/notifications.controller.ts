import {
  Body,
  Controller,
  Get,
  HttpCode,
  type MessageEvent,
  Post,
  Sse,
} from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
import { interval, map, merge, type Observable, takeUntil } from 'rxjs';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { NotificationsService } from './notifications.service.js';

class MarkReadDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids!: string[];
}

/** Every signed-in user has their own bell; no extra permission needed. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  /**
   * Live feed (Server-Sent Events). A comment-like "ping" every 25 s keeps
   * proxies from closing an idle connection.
   */
  @Sse('stream')
  stream(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return merge(
      this.notifications.stream(user.id),
      interval(25_000).pipe(map(() => ({ type: 'ping', data: '' }))),
    ).pipe(takeUntil(this.notifications.closing));
  }

  @Post('read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Body() dto: MarkReadDto) {
    return this.notifications.markRead(user.id, dto.ids);
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markRead(user.id, 'all');
  }
}

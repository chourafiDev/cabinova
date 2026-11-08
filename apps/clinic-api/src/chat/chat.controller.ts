import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { ChatService } from './chat.service.js';
import {
  CreateConversationDto,
  MessagesQuery,
  SendMessageDto,
  UpdateConversationDto,
} from './dto.js';

/** Messages between the cabinet's staff, every role alike. */
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  list(@Clinic() { db }: ClinicContext, @CurrentUser() user: ClinicUser) {
    return this.chat.list(db, user.id);
  }

  /** The sidebar's badge. */
  @Get('unread')
  unread(@Clinic() { db }: ClinicContext, @CurrentUser() user: ClinicUser) {
    return this.chat.unread(db, user.id);
  }

  @Get('people')
  people(@Clinic() { db }: ClinicContext, @CurrentUser() user: ClinicUser) {
    return this.chat.people(db, user.id);
  }

  @Post('conversations')
  create(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.chat.create(db, user.id, dto);
  }

  @Put('conversations/:id')
  @HttpCode(204)
  update(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.chat.update(db, id, user.id, dto);
  }

  @Get('conversations/:id/messages')
  messages(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MessagesQuery,
  ) {
    return this.chat.messages(db, id, user.id, query.before);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('conversations/:id/messages')
  send(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.send(db, id, user.id, dto.body);
  }

  @Post('conversations/:id/read')
  @HttpCode(204)
  read(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chat.markRead(db, id, user.id);
  }
}

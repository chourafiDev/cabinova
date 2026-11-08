import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const MAX_MESSAGE = 4000;

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** One colleague: their direct conversation; several: a named group. */
export class CreateConversationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  userIds: string[];

  @trim()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;
}

export class SendMessageDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MESSAGE)
  body: string;
}

/** How the signed-in person keeps this conversation in their list. */
export class UpdateConversationDto {
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  muted?: boolean;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class MessagesQuery {
  /** Older than this message's time: the previous page. */
  @IsOptional()
  @IsISO8601()
  before?: string;
}

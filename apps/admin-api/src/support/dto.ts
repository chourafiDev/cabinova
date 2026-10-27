import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const TICKET_TYPES = [
  'assistance',
  'incident',
  'configuration',
  'billing',
] as const;
export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'waiting',
  'resolved',
  'closed',
] as const;
export const TICKET_CHANNELS = ['phone', 'email', 'internal'] as const;
/** Inbox views. */
export const TICKET_VIEWS = [
  'active',
  'mine',
  'unassigned',
  'overdue',
  'waiting',
  'done',
  'all',
] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class TicketsQuery {
  @IsOptional()
  @IsIn(TICKET_VIEWS)
  view: (typeof TICKET_VIEWS)[number] = 'active';

  @IsOptional()
  @IsIn(TICKET_TYPES)
  type?: (typeof TICKET_TYPES)[number];

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: (typeof TICKET_PRIORITIES)[number];

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  /** Number, subject, cabinet or contact. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage = 25;
}

export class CreateTicketDto {
  /** Omitted for a platform-wide incident. */
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsIn(TICKET_TYPES)
  type!: (typeof TICKET_TYPES)[number];

  @IsIn(TICKET_PRIORITIES)
  priority!: (typeof TICKET_PRIORITIES)[number];

  @IsIn(TICKET_CHANNELS)
  channel!: (typeof TICKET_CHANNELS)[number];

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  subject!: string;

  /** What the cabinet reported. */
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(10_000)
  description!: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  requesterName?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  @MaxLength(200)
  requesterEmail?: string | null;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  /** E-mail an acknowledgement to the requester. */
  @IsOptional()
  @IsBoolean()
  notify?: boolean;
}

export class UpdateTicketDto {
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: (typeof TICKET_STATUSES)[number];

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: (typeof TICKET_PRIORITIES)[number];

  @IsOptional()
  @IsIn(TICKET_TYPES)
  type?: (typeof TICKET_TYPES)[number];

  /** null unassigns. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  requesterName?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  @MaxLength(200)
  requesterEmail?: string | null;
}

export class AddMessageDto {
  /** reply: e-mailed to the cabinet · note: internal · clinic: the cabinet's answer, logged. */
  @IsIn(['reply', 'note', 'clinic'])
  kind!: 'reply' | 'note' | 'clinic';

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  body!: string;

  /** Status to set afterwards; defaults depend on the kind. */
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: (typeof TICKET_STATUSES)[number];
}

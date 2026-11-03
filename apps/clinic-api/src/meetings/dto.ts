import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  );

/** Now (no startsAt) or planned; the people invited, from the team. */
export class CreateMeetingDto {
  @IsOptional()
  @clean()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  participantIds: string[];

  @IsOptional()
  @IsISO8601({ strict: true })
  startsAt?: string;

  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes: number;
}

export class AddParticipantsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  userIds: string[];
}

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListMedicationsQuery {
  /** Brand or substance, anywhere in the word. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsIn(['marketed', 'not_marketed', 'withdrawn', 'inactive'])
  availability?: 'marketed' | 'not_marketed' | 'withdrawn' | 'inactive';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;
}

import { IsIn, IsString, MaxLength } from 'class-validator';

/** The offer the doctor wants to move to from the trial. */
export class RequestQuoteDto {
  @IsString()
  @MaxLength(40)
  planKey: string;

  @IsIn(['monthly', 'annual'])
  billingPeriod: 'monthly' | 'annual';
}

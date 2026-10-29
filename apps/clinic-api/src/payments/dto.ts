import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const PAYMENT_METHODS = ['cash', 'card', 'cheque', 'transfer'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** 100 000 MAD: far above any visit, stops a typo with extra zeros. */
const MAX_AMOUNT = 10_000_000;

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
/** Trims; empty → null. */
const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

/** A price-list act (Paramètres › Tarifs). Prices in centimes. */
export class ActDto {
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  price: number;
}

export class ActsQuery {
  /** The owner's list includes archived acts. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true')
  @IsBoolean()
  archived?: boolean;
}

export class ChargeItemDto {
  @IsOptional()
  @IsUUID()
  actId?: string;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label: string;

  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  unitPrice: number;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

export class PaymentDto {
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT)
  amount: number;

  @IsIn(PAYMENT_METHODS, { message: 'Mode de paiement invalide.' })
  method: PaymentMethod;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string | null;
}

/** A visit's acts (replacing the previous ones) and, optionally, a payment now. */
export class CheckoutDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Ajoutez au moins un acte.' })
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ChargeItemDto)
  items: ChargeItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDto)
  payment?: PaymentDto;
}

export class CancelPaymentDto {
  @trim()
  @IsString()
  @MinLength(3, { message: 'Indiquez la raison (3 caractères minimum).' })
  @MaxLength(300)
  reason: string;
}

export class RefundDto extends PaymentDto {
  @trim()
  @IsString()
  @MinLength(3, { message: 'Indiquez la raison (3 caractères minimum).' })
  @MaxLength(300)
  reason: string;
}

export class CashCloseDto {
  /** Cash counted in the drawer, in centimes. */
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT * 10)
  countedCash: number;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The owner's history: a period of Moroccan days, a space, a method. */
export class PaymentsQuery {
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;

  @IsOptional()
  @IsUUID()
  space?: string;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: PaymentMethod;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

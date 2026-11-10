import { IsIn, IsOptional } from 'class-validator';

export const DOCUMENT_CATEGORIES = [
  'lab',
  'imaging',
  'prescription',
  'report',
  'administrative',
  'other',
] as const;

/** The form fields sent with the file (multipart). */
export class DocumentDto {
  @IsOptional()
  @IsIn(DOCUMENT_CATEGORIES)
  category?: (typeof DOCUMENT_CATEGORIES)[number];
}

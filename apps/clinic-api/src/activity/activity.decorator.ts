import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { ClinicUser } from '../auth/auth.types.js';
import type { ActivityEntity } from './activity.service.js';

export const ACTIVITY = 'activity';

export type ActivityOptions = {
  /** e.g. "patient.update"; the app words it (lib/activity.ts). */
  action: string;
  entity?: ActivityEntity;
  /** A short fact from the request, never medical content. */
  detail?: (req: Request) => string | undefined;
  /** Recorded only for these people. */
  only?: (user: ClinicUser) => boolean;
  /** Consultations, not changes: once an hour per person and record. */
  hourly?: boolean;
};

/** Writes a journal entry when the route succeeds. */
export const Activity = (
  action: string,
  entity?: ActivityEntity,
  options: Omit<ActivityOptions, 'action' | 'entity'> = {},
) => SetMetadata(ACTIVITY, { action, entity, ...options });

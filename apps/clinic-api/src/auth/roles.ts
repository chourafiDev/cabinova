import { ForbiddenException } from '@nestjs/common';
import type { ClinicUser } from './auth.types.js';

/** Roles that may read and write medical data (antécédents, consultations). */
const MEDICAL_ROLES = new Set(['owner', 'doctor']);

export const isMedical = (user: ClinicUser) => MEDICAL_ROLES.has(user.role);

export function assertMedical(user: ClinicUser) {
  if (!isMedical(user)) {
    throw new ForbiddenException({
      code: 'MEDICAL_ONLY',
      message: 'Réservé aux médecins du cabinet.',
    });
  }
}

/** Cabinet-wide settings: the responsible doctor only. */
export function assertOwner(user: ClinicUser) {
  if (user.role !== 'owner') {
    throw new ForbiddenException({
      code: 'OWNER_ONLY',
      message: 'Réservé au médecin responsable du cabinet.',
    });
  }
}

import { ForbiddenException } from '@nestjs/common';
import type { ClinicUser } from './auth.types.js';

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Médecin responsable',
  doctor: 'Médecin',
  secretary: 'Secrétaire',
};

/** Roles the owner gives in Équipe (there is one owner per cabinet). */
export const STAFF_ROLES = ['doctor', 'secretary'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

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

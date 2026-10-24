// Cabinet lifecycle (Module 2, Scenarios C and D of "Partie super admin").
//
//   pending → provisioning → active ⇄ suspended
//                              ↓         ↓
//                          closure_pending → closed
//
// `tenants.status` is never written directly: every change goes through one
// of these named transitions, which says which statuses it may start from.
// Keep the reason catalog in sync with apps/admin-web/src/lib/tenants.ts.

export type TenantStatus =
  | 'pending'
  | 'provisioning'
  | 'active'
  | 'suspended'
  | 'closure_pending'
  | 'closed';

type Transition = {
  from: readonly TenantStatus[];
  to: TenantStatus;
  /**
   * Run by the platform itself (Module 4 provisioning), never requested
   * from the status dialog.
   */
  system?: true;
  /** Allowed motives; an empty list means the transition takes none. */
  reasons: readonly string[];
};

export const TENANT_TRANSITIONS = {
  provision: {
    from: ['pending'],
    to: 'provisioning',
    system: true,
    reasons: [],
  },
  activate: { from: ['provisioning'], to: 'active', system: true, reasons: [] },
  /** Provisioning failed: back to pending so it can be retried. */
  provision_failed: {
    from: ['provisioning'],
    to: 'pending',
    system: true,
    reasons: [],
  },
  suspend: {
    from: ['active'],
    to: 'suspended',
    reasons: [
      'unpaid',
      'owner_request',
      'fraud',
      'security_incident',
      'contract_breach',
      'support_temporary',
    ],
  },
  reactivate: {
    from: ['suspended', 'closure_pending'],
    to: 'active',
    reasons: [
      'payment_regularized',
      'incident_resolved',
      'owner_request',
      'other',
    ],
  },
  start_closure: {
    from: ['active', 'suspended'],
    to: 'closure_pending',
    reasons: [
      'owner_request',
      'temporary_closure',
      'contract_end',
      'unpaid',
      'other',
    ],
  },
  close: {
    from: ['closure_pending'],
    to: 'closed',
    reasons: ['closure_period_ended', 'owner_request', 'other'],
  },
} as const satisfies Record<string, Transition>;

export type TenantTransition = keyof typeof TENANT_TRANSITIONS;

/** Transitions an admin can request from the cabinet page. */
export const MANUAL_TRANSITIONS = (
  Object.keys(TENANT_TRANSITIONS) as TenantTransition[]
).filter((key) => !('system' in TENANT_TRANSITIONS[key]));

export function canTransition(status: TenantStatus, action: TenantTransition) {
  return (TENANT_TRANSITIONS[action].from as readonly TenantStatus[]).includes(
    status,
  );
}

/** Manual transitions available from `status`, in display order. */
export function availableTransitions(status: TenantStatus) {
  return MANUAL_TRANSITIONS.filter((action) => canTransition(status, action));
}

export function isValidReason(action: TenantTransition, reason: string) {
  return (TENANT_TRANSITIONS[action].reasons as readonly string[]).includes(
    reason,
  );
}

/** A closed cabinet is read-only: no edits, no further transitions. */
export const isEditable = (status: TenantStatus) => status !== 'closed';

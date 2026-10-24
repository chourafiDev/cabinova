import {
  availableTransitions,
  canTransition,
  isValidReason,
  MANUAL_TRANSITIONS,
  TENANT_TRANSITIONS,
  type TenantStatus,
} from './lifecycle.js';

describe('tenant lifecycle', () => {
  it('only exposes admin transitions to the status dialog', () => {
    expect(MANUAL_TRANSITIONS).toEqual([
      'suspend',
      'reactivate',
      'start_closure',
      'close',
    ]);
  });

  it.each<[TenantStatus, string[]]>([
    ['pending', []],
    ['provisioning', []],
    ['active', ['suspend', 'start_closure']],
    ['suspended', ['reactivate', 'start_closure']],
    ['closure_pending', ['reactivate', 'close']],
    ['closed', []],
  ])('from %s allows %j', (status, expected) => {
    expect(availableTransitions(status)).toEqual(expected);
  });

  it('follows pending → provisioning → active for provisioning', () => {
    expect(canTransition('pending', 'provision')).toBe(true);
    expect(canTransition('provisioning', 'activate')).toBe(true);
    expect(canTransition('pending', 'activate')).toBe(false);
  });

  it('never leaves closed', () => {
    for (const action of Object.keys(TENANT_TRANSITIONS)) {
      expect(
        canTransition('closed', action as keyof typeof TENANT_TRANSITIONS),
      ).toBe(false);
    }
  });

  it('cannot close without going through closure_pending', () => {
    expect(canTransition('active', 'close')).toBe(false);
    expect(canTransition('suspended', 'close')).toBe(false);
  });

  it('checks reasons per transition', () => {
    expect(isValidReason('suspend', 'fraud')).toBe(true);
    expect(isValidReason('reactivate', 'fraud')).toBe(false);
    expect(isValidReason('close', 'closure_period_ended')).toBe(true);
  });
});

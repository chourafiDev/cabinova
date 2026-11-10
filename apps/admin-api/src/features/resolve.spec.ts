import { resolveFeature } from './resolve.js';

const now = new Date('2026-10-24T12:00:00Z');
const day = (offset: number) => new Date(now.getTime() + offset * 86_400_000);

describe('feature resolution', () => {
  it('follows the plan by default', () => {
    expect(
      resolveFeature({
        status: 'active',
        planLevel: 'included',
        override: null,
        now,
      }),
    ).toEqual({
      level: 'included',
      enabled: true,
      source: 'plan',
    });
  });

  it('treats an add-on as offered, not enabled, and no plan as none', () => {
    expect(
      resolveFeature({
        status: 'active',
        planLevel: 'addon',
        override: null,
        now,
      }).enabled,
    ).toBe(false);
    expect(
      resolveFeature({ status: 'active', planLevel: null, override: null, now })
        .level,
    ).toBe('none');
  });

  it('applies an exception only within its dates', () => {
    const override = {
      level: 'included' as const,
      startsAt: day(-1),
      endsAt: day(1),
    };
    expect(
      resolveFeature({ status: 'active', planLevel: 'none', override, now })
        .source,
    ).toBe('override');
    expect(
      resolveFeature({
        status: 'active',
        planLevel: 'none',
        override: { ...override, endsAt: day(-0.5) },
        now,
      }),
    ).toMatchObject({ source: 'plan', enabled: false });
    expect(
      resolveFeature({
        status: 'active',
        planLevel: 'none',
        override: { ...override, startsAt: day(2), endsAt: null },
        now,
      }).source,
    ).toBe('plan');
  });

  it('can withdraw a feature the plan gives', () => {
    const override = { level: 'none' as const, startsAt: null, endsAt: null };
    expect(
      resolveFeature({
        status: 'active',
        planLevel: 'included',
        override,
        now,
      }),
    ).toMatchObject({
      enabled: false,
      source: 'override',
    });
  });

  it('keeps beta features to testers, whatever the plan', () => {
    expect(
      resolveFeature({
        status: 'beta',
        planLevel: 'included',
        override: null,
        now,
      }),
    ).toMatchObject({
      enabled: false,
      source: 'beta',
    });
    const tester = { level: 'included' as const, startsAt: null, endsAt: null };
    expect(
      resolveFeature({
        status: 'beta',
        planLevel: 'none',
        override: tester,
        now,
      }).enabled,
    ).toBe(true);
  });

  it('switches a disabled feature off everywhere, exceptions included', () => {
    const override = {
      level: 'included' as const,
      startsAt: null,
      endsAt: null,
    };
    expect(
      resolveFeature({
        status: 'disabled',
        planLevel: 'included',
        override,
        now,
      }),
    ).toMatchObject({
      enabled: false,
      source: 'kill_switch',
    });
  });

  it('never enables a feature the code does not implement', () => {
    expect(
      resolveFeature({
        status: 'active',
        planLevel: 'included',
        override: { level: 'included', startsAt: null, endsAt: null },
        now,
        implemented: false,
      }),
    ).toEqual({ level: 'none', enabled: false, source: 'not_implemented' });
  });
});

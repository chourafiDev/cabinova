import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { FEATURE_KEYS, FEATURES, isFeatureKey } from '@cabinova/features';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PLANS } from '../plans/catalog.js';

const pkgDir = dirname(
  createRequire(import.meta.url).resolve('@cabinova/features/package.json'),
);

describe('feature registry (@cabinova/features)', () => {
  it('declares exactly the keys it implements (index.d.ts = index.js)', () => {
    const dts = readFileSync(join(pkgDir, 'src/index.d.ts'), 'utf8');
    const union = dts.slice(
      dts.indexOf('FeatureKey ='),
      dts.indexOf(';', dts.indexOf('FeatureKey =')),
    );
    const typed = [...union.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
    expect([...typed].sort()).toEqual([...FEATURE_KEYS].sort());
  });

  it('uses unique, well-formed keys', () => {
    expect(new Set(FEATURE_KEYS).size).toBe(FEATURES.length);
    for (const key of FEATURE_KEYS)
      expect(key).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/);
  });

  it('gives every default plan a level for every feature', () => {
    for (const plan of DEFAULT_PLANS) {
      expect(Object.keys(plan.features).sort()).toEqual(
        [...FEATURE_KEYS].sort(),
      );
    }
  });

  it('recognises only implemented keys', () => {
    expect(isFeatureKey('sms_reminders')).toBe(true);
    expect(isFeatureKey('test')).toBe(false);
  });
});

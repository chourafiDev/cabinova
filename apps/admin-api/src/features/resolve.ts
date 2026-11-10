import type { FeatureLevel } from '../plans/catalog.js';

// "Fonctionnalités et options" — what a cabinet actually gets for one
// feature. One rule, used by the API, the cabinet page and (later) the
// clinic app, so they can never disagree.

export type FeatureStatus = 'active' | 'beta' | 'disabled';

/**
 * not_implemented — no code behind it (absent from @cabinova/features)
 * kill_switch — switched off everywhere (incident)
 * override    — the cabinet's exception, within its dates
 * beta        — feature in beta and the cabinet isn't a tester
 * plan        — the cabinet's plan level (or none without a plan)
 */
export type FeatureSource =
  'not_implemented' | 'kill_switch' | 'override' | 'beta' | 'plan';

export type Override = {
  level: FeatureLevel;
  startsAt: Date | null;
  endsAt: Date | null;
};

/** Levels that mean "the cabinet can use it". "addon" is offered, not enabled. */
export const ENABLED_LEVELS: readonly FeatureLevel[] = [
  'included',
  'limited',
  'custom',
];

export const isOverrideActive = (o: Override, now: Date) =>
  (!o.startsAt || o.startsAt <= now) && (!o.endsAt || o.endsAt > now);

export function resolveFeature(input: {
  status: FeatureStatus;
  /** The cabinet's plan level; null when it has no live subscription. */
  planLevel: FeatureLevel | null;
  override: Override | null;
  now: Date;
  /** In the code registry; false = never available, whatever the admin says. */
  implemented?: boolean;
}): { level: FeatureLevel; enabled: boolean; source: FeatureSource } {
  const result = (level: FeatureLevel, source: FeatureSource) => ({
    level,
    enabled: ENABLED_LEVELS.includes(level),
    source,
  });
  if (input.implemented === false) return result('none', 'not_implemented');
  if (input.status === 'disabled') return result('none', 'kill_switch');
  if (input.override && isOverrideActive(input.override, input.now)) {
    return result(input.override.level, 'override');
  }
  if (input.status === 'beta') return result('none', 'beta');
  return result(input.planLevel ?? 'none', 'plan');
}

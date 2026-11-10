import { escapeLike, normalizeQuery } from './match.js';

describe('search query', () => {
  it('ignores searches that are too short or blank', () => {
    expect(normalizeQuery(undefined)).toBeNull();
    expect(normalizeQuery('  a ')).toBeNull();
    expect(normalizeQuery('   ')).toBeNull();
  });

  it('trims and collapses spaces', () => {
    expect(normalizeQuery('  Cabinet   Atlas ')).toBe('Cabinet Atlas');
  });

  it('caps the length', () => {
    expect(normalizeQuery('x'.repeat(500))).toHaveLength(100);
  });

  it('matches LIKE wildcards literally', () => {
    expect(escapeLike('100%_off\\')).toBe('100\\%\\_off\\\\');
  });
});

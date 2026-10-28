import { isBehind } from './schema-version.js';

describe('isBehind', () => {
  const tags = ['0000_baseline', '0001_sessions', '0002_tour'];

  it('is behind on an older or missing version', () => {
    expect(isBehind('0001_sessions', tags)).toBe(true);
    expect(isBehind(null, tags)).toBe(true);
  });

  it('is up to date on the latest, or on a version newer than this code', () => {
    expect(isBehind('0002_tour', tags)).toBe(false);
    expect(isBehind('0003_from_the_future', tags)).toBe(false);
  });

  it('knows the real migrations of @cabinova/tenant-db', () => {
    expect(isBehind('0000_baseline')).toBe(true);
  });
});

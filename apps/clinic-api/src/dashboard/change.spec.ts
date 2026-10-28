import { percentChange } from './change.js';

describe('percentChange', () => {
  it('rounds the change', () => {
    expect(percentChange(4, 3)).toBe(33);
    expect(percentChange(2, 4)).toBe(-50);
    expect(percentChange(5, 5)).toBe(0);
  });

  it('has nothing to compare with a zero baseline', () => {
    expect(percentChange(3, 0)).toBeNull();
  });
});

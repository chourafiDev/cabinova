import {
  base32Decode,
  base32Encode,
  hotp,
  newRecoveryCodes,
  newTotpSecret,
  verifyTotp,
} from './totp.js';

// RFC 6238 appendix B: SHA-1 key "12345678901234567890".
const RFC_KEY = Buffer.from('12345678901234567890');

describe('TOTP', () => {
  it('matches the RFC 6238 test vectors', () => {
    // T = 59 s → step 1 → 94287082 (8 digits)
    expect(hotp(RFC_KEY, 1, 8)).toBe('94287082');
    // T = 1111111109 s → 07081804
    expect(hotp(RFC_KEY, Math.floor(1111111109 / 30), 8)).toBe('07081804');
  });

  it('round-trips base32', () => {
    expect(base32Decode(base32Encode(RFC_KEY)).equals(RFC_KEY)).toBe(true);
    expect(base32Encode(RFC_KEY)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('accepts the current code with one step of drift, and refuses replays', () => {
    const secret = newTotpSecret();
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30_000);
    const code = hotp(base32Decode(secret), step);
    expect(verifyTotp(secret, code, { now })).toBe(step);
    expect(verifyTotp(secret, code, { now: now + 30_000 })).toBe(step);
    expect(verifyTotp(secret, code, { now: now + 90_000 })).toBeNull();
    expect(verifyTotp(secret, code, { now, lastStep: step })).toBeNull();
    expect(verifyTotp(secret, '12345', { now })).toBeNull();
  });

  it('issues ten distinct backup codes', () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
  });
});

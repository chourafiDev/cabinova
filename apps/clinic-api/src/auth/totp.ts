import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// RFC 6238 time-based one-time passwords (authenticator apps: Google
// Authenticator, Microsoft Authenticator, 1Password…): HMAC-SHA1, 30 s
// steps, 6 digits. No dependency: Node's crypto is enough.

const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret, base32 (what the authenticator app stores). */
export const newTotpSecret = () => base32Encode(randomBytes(20));

/** RFC 4226 HOTP for one counter value. */
export function hotp(secret: Buffer, counter: number, digits = DIGITS) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, '0');
}

export const timeStep = (now = Date.now()) =>
  Math.floor(now / 1000 / STEP_SECONDS);

/**
 * The step a code matches, allowing one step of clock drift either way, or
 * null. Steps at or before `lastStep` are refused (no replay).
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  options: { now?: number; lastStep?: number | null } = {},
) {
  const digits = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(digits)) return null;
  const secret = base32Decode(secretBase32);
  const current = timeStep(options.now);
  for (const step of [current - 1, current, current + 1]) {
    if (options.lastStep != null && step <= options.lastStep) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, Buffer.from(digits))) return step;
  }
  return null;
}

/** otpauth:// URI the authenticator app scans (as a QR code). */
export const otpauthUrl = (
  secretBase32: string,
  account: string,
  issuer = 'Cabinova',
) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;

/** Ten one-time backup codes, "xxxx-xxxx" (shown once, stored hashed). */
export const newRecoveryCodes = () =>
  Array.from({ length: 10 }, () => {
    const raw = randomBytes(5).toString('hex');
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });

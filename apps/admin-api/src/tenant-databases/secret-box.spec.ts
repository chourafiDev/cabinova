import { randomBytes } from 'node:crypto';
import { SecretBox } from './secret-box.js';

const key = () => randomBytes(32);

describe('SecretBox', () => {
  const box = new SecretBox(new Map([[1, key()]]), 1);

  it('round-trips a secret for the same tenant', () => {
    const { ciphertext, keyVersion } = box.encrypt('s3cret', 'tenant-a');
    expect(ciphertext).not.toContain('s3cret');
    expect(box.decrypt(ciphertext, keyVersion, 'tenant-a')).toBe('s3cret');
  });

  it('refuses a ciphertext moved to another tenant', () => {
    const { ciphertext } = box.encrypt('s3cret', 'tenant-a');
    expect(() => box.decrypt(ciphertext, 1, 'tenant-b')).toThrow();
  });

  it('detects tampering', () => {
    const { ciphertext } = box.encrypt('s3cret', 'tenant-a');
    const raw = Buffer.from(ciphertext, 'base64');
    raw[raw.length - 1] ^= 1;
    expect(() => box.decrypt(raw.toString('base64'), 1, 'tenant-a')).toThrow();
  });

  it('reads old versions after a key rotation', () => {
    const v1 = key();
    const old = new SecretBox(new Map([[1, v1]]), 1).encrypt('x', 't');
    const rotated = SecretBox.fromEnv(
      key().toString('base64'),
      2,
      `1:${v1.toString('base64')}`,
    );
    expect(rotated.decrypt(old.ciphertext, 1, 't')).toBe('x');
    expect(rotated.encrypt('y', 't').keyVersion).toBe(2);
  });
});

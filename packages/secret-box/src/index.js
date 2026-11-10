// Plain JavaScript (with index.d.ts) so both NestJS apps can run it from
// node_modules without a build step, like @cabinova/features.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * AES-256-GCM for clinic database credentials. Each ciphertext is bound to
 * its tenant (additional authenticated data), so a row copied onto another
 * tenant fails to decrypt instead of leaking credentials across clinics.
 * Several key versions can be loaded at once to rotate the master key.
 */
export class SecretBox {
  /**
   * @param {ReadonlyMap<number, Buffer>} keys
   * @param {number} currentVersion
   */
  constructor(keys, currentVersion) {
    if (!keys.has(currentVersion)) {
      throw new Error(`No key loaded for version ${currentVersion}`);
    }
    for (const [version, key] of keys) {
      if (key.length !== 32) throw new Error(`Key v${version} is not 32 bytes`);
    }
    this.keys = keys;
    this.currentVersion = currentVersion;
  }

  /**
   * @param {string} plaintext
   * @param {string} context
   */
  encrypt(plaintext, context) {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(
      'aes-256-gcm',
      this.keys.get(this.currentVersion),
      iv,
    );
    cipher.setAAD(Buffer.from(context));
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      ciphertext: Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64'),
      keyVersion: this.currentVersion,
    };
  }

  /**
   * @param {string} ciphertext
   * @param {number} keyVersion
   * @param {string} context
   */
  decrypt(ciphertext, keyVersion, context) {
    const key = this.keys.get(keyVersion);
    if (!key) throw new Error(`Master key v${keyVersion} is not loaded`);
    const raw = Buffer.from(ciphertext, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_BYTES));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * From env: the current key plus "1:<base64>,2:<base64>" previous ones.
   * @param {string} current
   * @param {number} version
   * @param {string} [previous]
   */
  static fromEnv(current, version, previous) {
    const keys = new Map();
    for (const entry of previous?.split(',').filter(Boolean) ?? []) {
      const [v, key] = entry.split(':');
      keys.set(Number(v), Buffer.from(key, 'base64'));
    }
    keys.set(version, Buffer.from(current, 'base64'));
    return new SecretBox(keys, version);
  }
}

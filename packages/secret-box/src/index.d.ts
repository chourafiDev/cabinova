/** AES-256-GCM with per-tenant context (AAD) and versioned master keys. */
export declare class SecretBox {
  readonly currentVersion: number;
  constructor(keys: ReadonlyMap<number, Buffer>, currentVersion: number);
  encrypt(plaintext: string, context: string): { ciphertext: string; keyVersion: number };
  decrypt(ciphertext: string, keyVersion: number, context: string): string;
  /** From env: the current key plus "1:<base64>,2:<base64>" previous ones. */
  static fromEnv(current: string, version: number, previous?: string): SecretBox;
}

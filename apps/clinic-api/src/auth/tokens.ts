import { createHash, randomBytes } from 'node:crypto';

/** Random URL-safe token (sessions, invitations). Only its hash is stored. */
export const newToken = () => randomBytes(32).toString('base64url');

export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

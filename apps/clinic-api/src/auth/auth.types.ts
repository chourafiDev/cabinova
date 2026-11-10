/** A signed-in member of the cabinet's staff. */
export type ClinicUser = {
  sessionId: string;
  id: string;
  name: string;
  email: string;
  /** "owner" (responsible doctor), "doctor" or "secretary" (roles.ts). */
  role: string;
  /** The cabinet requires 2FA and this account hasn't set it up. */
  twoFactorSetupRequired: boolean;
};

declare module 'express' {
  interface Request {
    /** Set by SessionGuard on authenticated routes. */
    user?: ClinicUser;
  }
}

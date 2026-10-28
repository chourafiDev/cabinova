/** A signed-in member of the cabinet's staff. */
export type ClinicUser = {
  sessionId: string;
  id: string;
  name: string;
  email: string;
  /** "owner" (responsible doctor) for now; staff roles come with Équipe. */
  role: string;
};

declare module 'express' {
  interface Request {
    /** Set by SessionGuard on authenticated routes. */
    user?: ClinicUser;
  }
}

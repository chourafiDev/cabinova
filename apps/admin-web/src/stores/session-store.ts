"use client";

import { create } from "zustand";
import { can, type Permission } from "@/lib/permissions";
import type { Session } from "@/lib/session";

type SessionState = {
  session: Session | null;
  setSession: (session: Session | null) => void;
};

export const useSessionStore = create<SessionState>()((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));

/** `const allowed = useCan("patients:write")` */
export function useCan(permission: Permission) {
  return useSessionStore((s) => can(s.session?.user.permissions, permission));
}

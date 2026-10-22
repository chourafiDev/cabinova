"use client";

import { useEffect, useState } from "react";
import type { Session } from "@/lib/session";
import { useSessionStore } from "@/stores/session-store";

/**
 * Seeds the zustand session store from the server-fetched session: on first
 * render (before any child subscribes, so the first paint has it), then after
 * each router.refresh() in an effect.
 */
export function SessionProvider({ session, children }: { session: Session; children: React.ReactNode }) {
  useState(() => useSessionStore.setState({ session }));
  useEffect(() => {
    useSessionStore.setState({ session });
  }, [session]);
  return children;
}

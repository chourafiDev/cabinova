"use client";

import { createContext, useContext } from "react";

export type CurrentUser = { id: string; name: string; role: string };

const CurrentUserContext = createContext<CurrentUser | null>(null);

/** The signed-in staff member, for client components deep in the tree. */
export function CurrentUserProvider({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
	return <CurrentUserContext value={user}>{children}</CurrentUserContext>;
}

export function useCurrentUser() {
	const user = useContext(CurrentUserContext);
	if (!user) throw new Error("useCurrentUser outside the clinic layout");
	return user;
}

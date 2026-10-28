import { api } from "./api-client";
import type { Space } from "./session";

/** "Marrakech" or "Espace principal · Fès" */
export const spaceLabel = (s: Pick<Space, "name" | "city">) =>
	s.city && !s.name.toLowerCase().includes(s.city.toLowerCase()) ? `${s.name} · ${s.city}` : s.name;

/** Work in another space; returns where to go (the section's list, not a record of the old space). */
export async function switchSpace(spaceId: string, pathname: string) {
	await api("/spaces/current", { method: "PUT", body: JSON.stringify({ spaceId }) });
	const section = pathname.split("/")[1];
	return section ? `/${section}` : "/";
}

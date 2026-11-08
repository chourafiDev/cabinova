import { redirect } from "next/navigation";
import { pageTitle } from "@/i18n/titles";
import { getClinicState } from "@/lib/session";
import { MessagesView } from "./_components/messages-view";

export const generateMetadata = () => pageTitle("messages");

/** Messages: the staff write to each other, one to one, in groups, or to the whole cabinet. */
export default async function MessagesPage() {
	const state = await getClinicState();
	if (state.status !== "signed-in") redirect("/login");
	return <MessagesView />;
}

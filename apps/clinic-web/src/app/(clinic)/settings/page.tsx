import { redirect } from "next/navigation";

/** /settings opens on the first section. */
export default function SettingsPage() {
	redirect("/settings/profile");
}

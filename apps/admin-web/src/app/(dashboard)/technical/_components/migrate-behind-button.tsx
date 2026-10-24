"use client";

import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { plural } from "@/lib/plural";

type Result = { migrated: number; failed: { tenantId: string; error: string }[] };

/** Global migration: every clinic database behind the latest schema version. */
export function MigrateBehindButton({ behind }: { behind: number }) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	const run = () =>
		startTransition(async () => {
			try {
				const result = await api<Result>("/tenant-databases/migrate", { method: "POST" });
				if (result.failed.length) {
					toast.error(`${plural(result.failed.length, "base")} en échec, isolée(s) : voir le tableau.`);
				} else {
					toast.success(`${plural(result.migrated, "base migrée", "bases migrées")}`);
				}
				router.refresh();
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Migration impossible");
			}
		});

	return (
		<Button onClick={run} disabled={pending || behind === 0} className="md:w-auto w-full">
			{pending && <Loader className="animate-spin" />}
			Migrer les bases en retard{behind ? ` (${behind})` : ""}
		</Button>
	);
}

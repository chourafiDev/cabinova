"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { IconSpinner } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";

/** Confirms archiving (or restoring) a file. Records are never deleted. `onDone` refreshes the views. */
export function ArchiveDialog({
	open,
	onOpenChange,
	patientId,
	archived,
	name,
	onDone,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	patientId: string;
	archived: boolean;
	name: string;
	onDone: () => void;
}) {
	const [pending, setPending] = useState(false);
	const t = useTranslations("patients.archive");

	const run = async () => {
		setPending(true);
		try {
			await api(`/patients/${patientId}/${archived ? "restore" : "archive"}`, { method: "POST" });
			toast.success(archived ? t("restored") : t("archived"));
			onOpenChange(false);
			onDone();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("error"));
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{archived ? t("restoreTitle", { name }) : t("archiveTitle", { name })}</DialogTitle>
					<DialogDescription>
						{archived ? t("restoreHint") : t("archiveHint")}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t("cancel")}
					</Button>
					<Button onClick={run} disabled={pending}>
						{pending && <IconSpinner className="animate-spin" />} {archived ? t("restore") : t("archive")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

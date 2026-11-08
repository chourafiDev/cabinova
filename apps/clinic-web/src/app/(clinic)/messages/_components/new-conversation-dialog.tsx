"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { IconSearch, IconSpinner } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { CHAT_KEY, type ChatPerson } from "@/lib/chat";
import { fold, initials } from "@/lib/format";

/**
 * Who to write to: one colleague opens (or reopens) your conversation with
 * them; several make a group, which needs a name.
 */
export function NewConversationDialog({
	open,
	onOpenChange,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: (id: string) => void;
}) {
	const t = useTranslations("chat.newConversation");
	const roles = useTranslations("common.roles");
	const queryClient = useQueryClient();
	const [picked, setPicked] = useState<string[]>([]);
	const [name, setName] = useState("");
	const [query, setQuery] = useState("");
	const [saving, setSaving] = useState(false);
	const people = useQuery({
		queryKey: [...CHAT_KEY, "people"],
		queryFn: () => api<ChatPerson[]>("/chat/people"),
		enabled: open,
	});

	const group = picked.length > 1;
	const shown = (people.data ?? []).filter((p) => !query.trim() || fold(p.name).includes(fold(query.trim())));
	const close = (next: boolean) => {
		onOpenChange(next);
		if (!next) {
			setPicked([]);
			setName("");
			setQuery("");
		}
	};

	const create = async () => {
		if (picked.length === 0 || (group && name.trim().length < 2)) return;
		setSaving(true);
		try {
			const { id } = await api<{ id: string }>("/chat/conversations", {
				method: "POST",
				body: JSON.stringify({ userIds: picked, name: group ? name.trim() : undefined }),
			});
			await queryClient.invalidateQueries({ queryKey: CHAT_KEY });
			onCreated(id);
			close(false);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("error"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("title")}</DialogTitle>
					<DialogDescription>{t("description")}</DialogDescription>
				</DialogHeader>

				<div className="grid gap-3">
					<div className="relative">
						<IconSearch className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
						<Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} className="h-9 ps-9" />
					</div>
					<div className="max-h-72 overflow-y-auto rounded-lg border">
						{people.isPending ? (
							<div className="grid gap-2 p-2">
								<Skeleton className="h-10" />
								<Skeleton className="h-10" />
							</div>
						) : shown.length === 0 ? (
							<p className="text-muted-foreground p-4 text-center text-sm">{people.data?.length ? t("noMatch") : t("alone")}</p>
						) : (
							<ul className="divide-y">
								{shown.map((p) => {
									const checked = picked.includes(p.id);
									return (
										<li key={p.id}>
											<label className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-3 py-2">
												<Checkbox
													checked={checked}
													onCheckedChange={(on) =>
														setPicked((list) => (on === true ? (list.includes(p.id) ? list : [...list, p.id]) : list.filter((id) => id !== p.id)))
													}
													aria-label={p.name}
												/>
												<span className="bg-primary/12 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
													{initials(p.name)}
												</span>
												<span className="min-w-0 flex-1">
													<span className="block truncate text-sm font-medium">{p.name}</span>
													<span className="text-muted-foreground block text-xs">{roles(p.role)}</span>
												</span>
											</label>
										</li>
									);
								})}
							</ul>
						)}
					</div>
					{group && (
						<label className="grid gap-1.5 text-sm">
							<span className="font-medium">{t("groupName")}</span>
							<Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("groupPlaceholder")} maxLength={60} />
						</label>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => close(false)}>
						{t("cancel")}
					</Button>
					<Button onClick={create} disabled={saving || picked.length === 0 || (group && name.trim().length < 2)}>
						{saving && <IconSpinner className="animate-spin" />}
						{group ? t("createGroup", { count: picked.length }) : t("open")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

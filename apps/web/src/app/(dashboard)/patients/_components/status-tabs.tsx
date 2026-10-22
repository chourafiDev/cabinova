"use client";

import { useQueryStates } from "nuqs";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListTransition } from "../../_components/shared/list-transition";
import { statusParser } from "../_lib/search-params";

/** Actifs / Archivés. Changing tab goes back to page 1. */
export function StatusTabs() {
	const { startTransition } = useListTransition();
	const [{ status }, setParams] = useQueryStates(
		{ status: statusParser, page: { parse: Number, serialize: String } },
		{ shallow: false, startTransition },
	);

	return (
		<Tabs
			value={status}
			onValueChange={(value) => setParams({ status: value as typeof status, page: null })}
			className="mb-3"
		>
			<TabsList>
				<TabsTrigger value="active">Actifs</TabsTrigger>
				<TabsTrigger value="archived">Archivés</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}

"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** One subject at a time. The tab stays put when the filters change. */
export function ReportsTabs({ tabs }: { tabs: { key: string; label: string; content: React.ReactNode }[] }) {
	return (
		<Tabs defaultValue={tabs[0].key} className="min-w-0 gap-4">
			<div className="-mx-1 overflow-x-auto border-b px-1">
				<TabsList variant="line" className="h-auto! p-0">
					{tabs.map((t) => (
						<TabsTrigger key={t.key} value={t.key} className="flex-none rounded-none px-3 py-2 group-data-horizontal/tabs:after:bottom-0">
							{t.label}
						</TabsTrigger>
					))}
				</TabsList>
			</div>
			{tabs.map((t) => (
				<TabsContent key={t.key} value={t.key} className="grid min-w-0 grid-cols-1 gap-4">
					{t.content}
				</TabsContent>
			))}
		</Tabs>
	);
}

"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** One subject at a time. The tab stays put when the filters change. */
export function ReportsTabs({ tabs }: { tabs: { key: string; label: string; content: React.ReactNode }[] }) {
	return (
		<Tabs defaultValue={tabs[0].key} className="min-w-0 gap-4">
			<div className="-mx-1 overflow-x-auto px-1">
				<TabsList>
					{tabs.map((t) => (
						<TabsTrigger key={t.key} value={t.key} className="flex-none px-3">
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

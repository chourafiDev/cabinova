import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

type Variant = "dashboard" | "list" | "detail" | "form";

/**
 * A page's shape while it loads (the routes' loading.tsx). Shown at once on
 * click, so the console never looks frozen while admin-api answers. Same
 * header and spacing as the real pages; nothing in it is clickable.
 */
export function PageSkeleton({ variant }: { variant: Variant }) {
	return (
		<div role="status" aria-busy="true">
			<span className="sr-only">Chargement de la page…</span>
			<div className="mb-4 flex items-center justify-between gap-2 border-b border-dashed border-foreground/20 pb-4">
				<div className="flex items-center gap-2">
					<Skeleton className="size-8 rounded-md" />
					<div className="grid gap-1.5">
						<Skeleton className="h-4 w-36" />
						<Skeleton className="h-3 w-56" />
					</div>
				</div>
				{variant === "list" && <Skeleton className="hidden h-9 w-40 md:block" />}
			</div>
			{BODIES[variant]}
		</div>
	);
}

const lines = (count: number) => Array.from({ length: count }, (_, i) => i);

const BODIES: Record<Variant, React.ReactNode> = {
	dashboard: (
		<div className="grid gap-3">
			<Skeleton className="h-9 w-full max-w-2xl rounded-lg" />
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{lines(4).map((i) => (
					<Skeleton key={i} className="h-32 rounded-xl" />
				))}
			</div>
			<div className="grid gap-3 lg:grid-cols-2">
				<Skeleton className="h-72 rounded-xl" />
				<Skeleton className="h-72 rounded-xl" />
			</div>
		</div>
	),
	list: <DataTableSkeleton columnCount={5} filterCount={2} rowCount={8} />,
	detail: (
		<div className="grid gap-4">
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				{lines(4).map((i) => (
					<Skeleton key={i} className="h-20 rounded-xl" />
				))}
			</div>
			<div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
				<Skeleton className="h-80 rounded-xl" />
				<Skeleton className="h-80 rounded-xl" />
			</div>
		</div>
	),
	form: (
		<div className="bg-card grid max-w-3xl gap-5 rounded-xl border p-5">
			{lines(5).map((i) => (
				<div key={i} className="grid gap-2">
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-9" />
				</div>
			))}
			<Skeleton className="h-9 w-32 justify-self-end" />
		</div>
	),
};

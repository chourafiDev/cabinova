import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

type Variant = "dashboard" | "list" | "agenda" | "detail" | "form" | "report" | "settings";

/**
 * A page's shape while it loads (the routes' loading.tsx). Shown at once on
 * click, so the app never looks frozen while clinic-api answers. Same spacing
 * as the real pages; nothing in it is clickable.
 */
export async function PageSkeleton({ variant }: { variant: Variant }) {
	const t = await getTranslations("common");
	return (
		<div role="status" aria-busy="true" className="grid gap-4">
			<span className="sr-only">{t("loadingPage")}</span>
			{variant !== "settings" && variant !== "agenda" && <HeaderSkeleton withAction={variant === "list"} />}
			{BODIES[variant]}
		</div>
	);
}

function HeaderSkeleton({ withAction }: { withAction: boolean }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div className="flex items-center gap-3">
				<Skeleton className="size-9 rounded-lg" />
				<div className="grid gap-1.5">
					<Skeleton className="h-5 w-40" />
					<Skeleton className="h-4 w-56" />
				</div>
			</div>
			{withAction && <Skeleton className="h-9 w-36" />}
		</div>
	);
}

const lines = (count: number) => Array.from({ length: count }, (_, i) => i);

const BODIES: Record<Variant, React.ReactNode> = {
	dashboard: (
		<>
			<Skeleton className="h-24 rounded-xl" />
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{lines(4).map((i) => (
					<Skeleton key={i} className="h-32 rounded-xl" />
				))}
			</div>
			<div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
				<Skeleton className="h-72 rounded-xl" />
				<Skeleton className="h-72 rounded-xl" />
			</div>
		</>
	),
	list: (
		<>
			<Skeleton className="h-8 w-56 rounded-lg" />
			<div className="bg-card grid gap-0 overflow-hidden rounded-xl border">
				<div className="flex gap-4 border-b p-3">
					{lines(4).map((i) => (
						<Skeleton key={i} className="h-4 flex-1" />
					))}
				</div>
				{lines(8).map((i) => (
					<div key={i} className="flex items-center gap-4 border-b p-3 last:border-0">
						<Skeleton className="size-8 rounded-full" />
						<Skeleton className="h-4 flex-1" />
						<Skeleton className="h-4 flex-1" />
						<Skeleton className="hidden h-4 flex-1 sm:block" />
					</div>
				))}
			</div>
		</>
	),
	agenda: (
		<>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex gap-2">
					<Skeleton className="h-9 w-24" />
					<Skeleton className="h-9 w-9" />
					<Skeleton className="h-9 w-9" />
				</div>
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-9 w-56" />
			</div>
			<div className="bg-card grid min-h-[60vh] grid-cols-[3rem_repeat(5,minmax(0,1fr))] gap-px overflow-hidden rounded-xl border">
				{lines(6).map((col) => (
					<div key={col} className="grid content-start gap-3 p-2">
						<Skeleton className="h-4" />
						{col > 0 && col % 2 === 1 && <Skeleton className="mt-8 h-16" />}
						{col > 0 && col % 2 === 0 && <Skeleton className="mt-20 h-24" />}
					</div>
				))}
			</div>
		</>
	),
	detail: (
		<div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
			<div className="grid content-start gap-4">
				<Skeleton className="h-48 rounded-xl" />
				<Skeleton className="h-32 rounded-xl" />
			</div>
			<div className="grid content-start gap-4">
				<Skeleton className="h-9 w-72 rounded-lg" />
				<Skeleton className="h-80 rounded-xl" />
			</div>
		</div>
	),
	form: <FormCardSkeleton />,
	report: (
		<>
			<Skeleton className="h-9 w-full max-w-xl rounded-lg" />
			<div className="flex flex-wrap gap-3">
				{lines(5).map((i) => (
					<Skeleton key={i} className="h-24 min-w-40 flex-1 rounded-xl" />
				))}
			</div>
			<Skeleton className="h-80 rounded-xl" />
		</>
	),
	// Inside the settings layout, which keeps its own header and menu.
	settings: (
		<>
			<FormCardSkeleton />
			<Skeleton className="h-32 rounded-xl" />
		</>
	),
};

function FormCardSkeleton() {
	return (
		<div className="bg-card grid max-w-3xl gap-5 rounded-xl border p-5">
			<Skeleton className="h-5 w-48" />
			{lines(4).map((i) => (
				<div key={i} className="grid gap-2">
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-9" />
				</div>
			))}
			<Skeleton className="h-9 w-32 justify-self-end" />
		</div>
	);
}

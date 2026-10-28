import type { CabinetInfo } from "@/lib/session";

/** Centered auth layout: the cabinet's mark and name, title, description, form. */
export function AuthCard({
	cabinet,
	title,
	description,
	children,
}: {
	cabinet: CabinetInfo;
	title: string;
	description: React.ReactNode;
	children?: React.ReactNode;
}) {
	return (
		<main className="bg-background min-h-screen flex items-center justify-center">
			<div className="flex w-full max-w-md flex-col items-center px-6 py-8 sm:px-10">
				<div className="flex items-center gap-3">
					<span className="flex size-10 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
						{cabinet.name.replace(/^cabinet\s+/i, "").charAt(0).toUpperCase()}
					</span>
					<span className="grid leading-tight">
						<span className="text-lg font-semibold">{cabinet.name}</span>
						{cabinet.specialty && <span className="text-xs text-muted-foreground">{cabinet.specialty}</span>}
					</span>
				</div>

				<div className="w-full py-10">
					<h1 className="text-2xl text-center font-semibold tracking-tight">{title}</h1>
					<p className="text-muted-foreground text-center mt-1 text-base">{description}</p>
					{children}
				</div>
				<p className="text-xs text-muted-foreground">Propulsé par Cabinova</p>
			</div>
		</main>
	);
}

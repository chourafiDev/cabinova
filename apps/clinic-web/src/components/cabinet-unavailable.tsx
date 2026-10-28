import { LuBuilding2, LuClock, LuLock, LuPlugZap } from "react-icons/lu";
import type { Unavailable } from "@/lib/server-api";

const ICONS: Record<string, typeof LuBuilding2> = {
	TENANT_NOT_READY: LuClock,
	TENANT_SUSPENDED: LuLock,
	SERVICE_UNAVAILABLE: LuPlugZap,
};

const TITLES: Record<string, string> = {
	TENANT_SUSPENDED: "Accès suspendu",
	TENANT_NOT_READY: "Cabinet en préparation",
	SERVICE_UNAVAILABLE: "Service indisponible",
};

/** Full page when this address can't be used: unknown cabinet, not ready, suspended, API down. */
export function CabinetUnavailable({ reason }: { reason: Unavailable }) {
	const Icon = ICONS[reason.code] ?? LuBuilding2;
	return (
		<main className="flex min-h-screen items-center justify-center bg-background p-6">
			<div className="flex max-w-sm flex-col items-center gap-3 text-center">
				<span className="flex size-12 items-center justify-center rounded-xl bg-muted">
					<Icon className="size-5 text-muted-foreground" />
				</span>
				<h1 className="text-lg font-semibold">{TITLES[reason.code] ?? "Cabinet introuvable"}</h1>
				<p className="text-sm text-muted-foreground">{reason.message}</p>
				<a href="mailto:support@cabinova.ma" className="text-sm font-medium hover:underline">
					Contacter le support Cabinova
				</a>
			</div>
		</main>
	);
}

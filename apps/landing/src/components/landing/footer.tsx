import { CONTACT_EMAIL, NAV } from "@/lib/site";
import { Logo } from "./logo";

export function Footer() {
	return (
		<footer className="border-t">
			<div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
				<div className="max-w-xs">
					<Logo />
					<p className="text-muted-foreground mt-3 text-sm">
						Le logiciel des cabinets médicaux au Maroc : agenda, dossiers, encaissements et statistiques.
					</p>
				</div>
				<nav aria-label="Pied de page" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
					{NAV.map((item) => (
						<a key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
							{item.label}
						</a>
					))}
					<a href={`mailto:${CONTACT_EMAIL}`} className="text-muted-foreground hover:text-foreground">
						Contact
					</a>
				</nav>
			</div>
			<div className="text-muted-foreground mx-auto max-w-6xl border-t px-4 py-6 text-xs sm:px-6">
				© {new Date().getFullYear()} Cabinova. Tous droits réservés.
			</div>
		</footer>
	);
}

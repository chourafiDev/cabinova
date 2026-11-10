import { CONTACT_EMAIL, NAV } from "@/lib/site";
import { Logo } from "./logo";

const PRODUCT = NAV.filter((n) => n.href.startsWith("#"));

/** A card of links, then the name in large letters fading into the page. */
export function Footer() {
	return (
		<footer className="overflow-hidden px-4 pt-4 sm:px-6">
			<div className="bg-muted/60 mx-auto grid max-w-6xl gap-10 rounded-[2rem] border p-8 sm:p-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
				<div className="max-w-xs">
					<Logo />
					<p className="text-muted-foreground mt-4 text-sm">
						Le logiciel des cabinets médicaux au Maroc : agenda, dossiers, encaissements et statistiques.
					</p>
				</div>
				<FooterColumn title="Produit" links={PRODUCT} />
				<FooterColumn
					title="Ressources"
					links={[
						{ href: "/docs", label: "Documentation" },
						{ href: "/docs/demarrer/premiers-pas", label: "Premiers pas" },
						{ href: "/docs/aide/faq", label: "Aide" },
					]}
				/>
				<div>
					<p className="font-medium">Contact</p>
					<p className="text-muted-foreground mt-4 text-sm">E-mail</p>
					<a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-primary text-sm font-medium">
						{CONTACT_EMAIL}
					</a>
				</div>
			</div>
			<p
				aria-hidden
				className="from-brand/80 mx-auto -mb-[0.2em] max-w-6xl bg-gradient-to-b to-transparent bg-clip-text pt-6 text-center text-[clamp(4rem,17vw,14rem)] leading-none font-semibold tracking-tighter text-transparent select-none"
			>
				Cabinova
			</p>
			<div className="text-muted-foreground mx-auto max-w-6xl border-t py-6 text-xs">© {new Date().getFullYear()} Cabinova. Tous droits réservés.</div>
		</footer>
	);
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
	return (
		<nav aria-label={title}>
			<p className="font-medium">{title}</p>
			<ul className="mt-4 grid gap-2.5 text-sm">
				{links.map((l) => (
					<li key={l.href}>
						<a href={l.href} className="text-muted-foreground hover:text-foreground">
							{l.label}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}

export function SiteFooter() {
	const year = new Date().getFullYear();

	return (
		<footer className="text-muted-foreground text-center border-t px-4 py-3 text-xs sm:flex-row">
			<p>© {year} Cabinova. Tous droits réservés.</p>
		</footer>
	);
}

import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({ variable: "--font-sans", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Cabinova — Le logiciel des cabinets médicaux au Maroc",
	description:
		"Agenda, dossiers patients, encaissements et statistiques : Cabinova organise votre cabinet médical, pour le médecin et la secrétaire. Essai gratuit de 7 jours.",
	openGraph: {
		title: "Cabinova — Le logiciel des cabinets médicaux au Maroc",
		description: "Agenda, dossiers patients, encaissements et statistiques, dans une base dédiée à votre cabinet.",
		locale: "fr_MA",
		type: "website",
	},
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="fr" className={`${instrumentSans.variable} ${geistMono.variable} antialiased`}>
			<body className="min-h-svh font-sans">{children}</body>
		</html>
	);
}

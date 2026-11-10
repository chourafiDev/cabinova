import type { Metadata } from "next";
import Script from "next/script";
import { Geist_Mono, Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({ variable: "--font-sans", subsets: ["latin", "latin-ext"] });
// Italic accents in the headings ("…en un seul endroit").
const instrumentSerif = Instrument_Serif({ variable: "--font-serif", weight: "400", style: ["normal", "italic"], subsets: ["latin", "latin-ext"] });
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

/** Sets the theme before the first paint: the visitor's choice, else the system's. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="fr" className={`${instrumentSans.variable} ${instrumentSerif.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
			<body className="min-h-svh font-sans">
				<Script id="theme" strategy="beforeInteractive">
					{THEME_SCRIPT}
				</Script>
				{children}
			</body>
		</html>
	);
}

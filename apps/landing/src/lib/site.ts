// Content of the public site. Prices and limits mirror the default offers
// (admin-api src/plans/catalog.ts): change both together.

export const CONTACT_EMAIL = "support@cabinova.ma";

/** Cabinets answer at <subdomain>.<TENANT_BASE_DOMAIN> (clinic-web). */
export const TENANT_BASE_DOMAIN = process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN ?? "cabinova.ma";
/** "https://{subdomain}.cabinova.ma"; "http://{subdomain}.localhost:3002" in development. */
export const CLINIC_APP_URL =
	process.env.NEXT_PUBLIC_CLINIC_APP_URL ??
	(process.env.NODE_ENV === "development"
		? "http://{subdomain}.localhost:3002"
		: `https://{subdomain}.${TENANT_BASE_DOMAIN}`);

export const demoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Démo Cabinova")}&body=${encodeURIComponent(
	"Bonjour,\n\nJe souhaite découvrir Cabinova pour mon cabinet.\n\nNom du cabinet :\nSpécialité :\nVille :\nTéléphone :\n",
)}`;

export const NAV = [
	{ href: "#fonctionnalites", label: "Fonctionnalités" },
	{ href: "#comment", label: "Comment ça marche" },
	{ href: "#securite", label: "Sécurité" },
	{ href: "#tarifs", label: "Tarifs" },
	{ href: "#faq", label: "FAQ" },
];

export type Plan = {
	key: string;
	name: string;
	description: string;
	/** MAD per month; per year when billed annually. */
	monthly: number;
	annual: number;
	highlights: string[];
	featured?: boolean;
};

export const TRIAL_DAYS = 7;

export const PLANS: Plan[] = [
	{
		key: "starter",
		name: "Starter",
		description: "Un médecin, l’essentiel du cabinet.",
		monthly: 299,
		annual: 2990,
		highlights: [
			"1 médecin et 1 secrétaire",
			"Agenda et salle d’attente",
			"Dossiers patients et antécédents",
			"Encaissements et reçus",
			"5 Go de stockage",
		],
	},
	{
		key: "pro",
		name: "Pro",
		description: "Statistiques avancées et rappels patients.",
		monthly: 599,
		annual: 5990,
		featured: true,
		highlights: [
			"1 médecin et jusqu’à 3 secrétaires",
			"Tout Starter, plus :",
			"Statistiques et chiffre d’affaires",
			"Rappels de rendez-vous par SMS (quota)",
			"Espaces supplémentaires en option",
			"20 Go de stockage",
		],
	},
	{
		key: "enterprise",
		name: "Enterprise",
		description: "Plusieurs médecins et sites, support prioritaire.",
		monthly: 1199,
		annual: 11990,
		highlights: [
			"Médecins illimités, jusqu’à 10 secrétaires",
			"Tout Pro, plus :",
			"Plusieurs sites (espaces) isolés",
			"Rappels SMS illimités",
			"Support prioritaire",
			"100 Go de stockage",
		],
	},
];

export const SPECIALTIES = [
	"Médecine générale",
	"Pédiatrie",
	"Cardiologie",
	"Dermatologie",
	"Gynécologie",
	"Ophtalmologie",
	"ORL",
	"Rhumatologie",
	"Endocrinologie",
	"Gastro-entérologie",
	"Pneumologie",
	"Kinésithérapie",
];

/*
 * EXEMPLES — à remplacer par de vrais avis (avec l’accord des médecins)
 * avant la mise en ligne. Ne publiez pas de faux témoignages.
 */
export const TESTIMONIALS = [
	{
		quote: "La salle d’attente et l’agenda sur le même écran : ma secrétaire sait toujours qui entre ensuite, et moi je retrouve les antécédents en un clic.",
		name: "Dr S. (exemple)",
		title: "Médecin généraliste · Casablanca",
	},
	{
		quote: "La clôture de caisse le soir nous prend deux minutes. Les écarts sont visibles tout de suite, sans tableur.",
		name: "Dr K. (exemple)",
		title: "Cardiologue · Rabat",
	},
	{
		quote: "Nous avons deux cabinets : chaque équipe ne voit que ses patients, et je suis l’activité des deux depuis les statistiques.",
		name: "Dr A. (exemple)",
		title: "Pédiatre · Marrakech et Safi",
	},
	{
		quote: "Les reçus numérotés avec le montant en lettres, c’est exactement ce que demandent les patients pour leur mutuelle.",
		name: "Dr M. (exemple)",
		title: "Dermatologue · Fès",
	},
];

export const FAQ = [
	{
		q: "Combien de temps faut-il pour démarrer ?",
		a: "Votre cabinet est créé en quelques minutes : vous recevez un lien pour choisir votre mot de passe, puis vous ajoutez vos horaires, vos tarifs et votre équipe depuis les Paramètres.",
	},
	{
		q: "Où sont stockées les données de mes patients ?",
		a: "Chaque cabinet a sa propre base de données, séparée de celles des autres cabinets. Les identifiants de connexion à cette base sont chiffrés, et les antécédents médicaux ne sont visibles que par les médecins.",
	},
	{
		q: "Ma secrétaire peut-elle voir les dossiers médicaux ?",
		a: "Non. Une secrétaire gère l’agenda, les dossiers administratifs et les encaissements, sans accès aux antécédents ni aux chiffres d’affaires du cabinet.",
	},
	{
		q: "J’ai plusieurs cabinets : comment ça se passe ?",
		a: "Chaque site est un espace isolé, avec ses patients, son agenda, ses horaires et son équipe. Le médecin responsable passe de l’un à l’autre et voit les statistiques de tous.",
	},
	{
		q: "Comment se passe le paiement de l’abonnement ?",
		a: `L’essai gratuit dure ${TRIAL_DAYS} jours, sans engagement. Ensuite, la facture arrive par e-mail et se règle par virement ; l’abonnement annuel offre deux mois.`,
	},
	{
		q: "Puis-je changer d’offre plus tard ?",
		a: "Oui, à tout moment depuis votre cabinet : vous passez à l’offre supérieure dès que vous ajoutez un médecin, une secrétaire ou un site.",
	},
];

/** "https://atlas.cabinova.ma" for a subdomain typed by the visitor. */
export const clinicUrl = (subdomain: string) => CLINIC_APP_URL.replace("{subdomain}", subdomain);

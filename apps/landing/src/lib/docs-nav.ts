// The documentation's plan: sections and pages, in reading order. Each page
// lives in src/content/docs/<slug>.md; this file gives its title and summary.

export type DocPage = { slug: string; title: string; description: string };
export type DocSection = { title: string; pages: DocPage[] };

export const DOCS: DocSection[] = [
	{
		title: "Démarrer",
		pages: [
			{ slug: "demarrer/introduction", title: "Introduction", description: "Ce que fait Cabinova et comment il est organisé." },
			{ slug: "demarrer/premiers-pas", title: "Premiers pas", description: "De la première connexion au premier rendez-vous." },
			{ slug: "demarrer/roles", title: "Rôles et permissions", description: "Ce que peuvent faire le médecin responsable, les médecins et les secrétaires." },
			{ slug: "demarrer/navigation", title: "Se déplacer dans l’application", description: "Le menu, la palette de commandes et les raccourcis clavier." },
		],
	},
	{
		title: "Agenda",
		pages: [
			{ slug: "agenda/vue-ensemble", title: "Vue d’ensemble", description: "Les cinq vues de l’agenda et le filtre par praticien." },
			{ slug: "agenda/prendre-rendez-vous", title: "Prendre un rendez-vous", description: "Créer, déplacer et modifier un rendez-vous." },
			{ slug: "agenda/suivre-une-visite", title: "Suivre une visite", description: "De l’arrivée du patient à la fin de la consultation." },
			{ slug: "agenda/horaires", title: "Horaires d’ouverture", description: "Définir les plages d’ouverture et la durée par défaut." },
		],
	},
	{
		title: "Patients",
		pages: [
			{ slug: "patients/dossiers", title: "Dossiers patients", description: "Créer, retrouver et compléter un dossier." },
			{ slug: "patients/constantes", title: "Constantes", description: "Poids, tension, glycémie : les mesures prises au cabinet." },
			{ slug: "patients/antecedents", title: "Antécédents", description: "Le profil médical, dans le dossier médical du médecin." },
			{ slug: "patients/archivage", title: "Archiver un dossier", description: "Sortir un dossier de la liste sans jamais le supprimer." },
		],
	},
	{
		title: "Encaissements",
		pages: [
			{ slug: "encaissements/encaisser", title: "Encaisser une visite", description: "Saisir les actes, recevoir un paiement et imprimer le reçu." },
			{ slug: "encaissements/remboursements", title: "Annuler ou rembourser", description: "Corriger une erreur de saisie ou rendre de l’argent à un patient." },
			{ slug: "encaissements/cloture", title: "Clôturer la caisse", description: "Compter les espèces et fermer la journée." },
			{ slug: "encaissements/historique", title: "Historique et clôtures", description: "Les totaux, les mouvements et les écarts de caisse." },
		],
	},
	{
		title: "Pilotage",
		pages: [
			{ slug: "pilotage/tableau-de-bord", title: "Tableau de bord", description: "La journée du cabinet en un coup d’œil." },
			{ slug: "pilotage/statistiques", title: "Statistiques", description: "Activité, revenus, patients et affluence sur une période." },
			{ slug: "pilotage/notifications", title: "Notifications", description: "Ce que signale la cloche, et à qui." },
		],
	},
	{
		title: "Votre cabinet",
		pages: [
			{ slug: "cabinet/informations", title: "Informations du cabinet", description: "Le nom, les coordonnées et l’adresse web." },
			{ slug: "cabinet/equipe", title: "Équipe", description: "Inviter, modifier et désactiver des membres." },
			{ slug: "cabinet/espaces", title: "Espaces", description: "Gérer plusieurs sites, séparés les uns des autres." },
			{ slug: "cabinet/tarifs", title: "Tarifs", description: "La liste des actes proposés à l’encaissement." },
		],
	},
	{
		title: "Sécurité",
		pages: [
			{ slug: "securite/compte", title: "Votre compte", description: "Profil, mot de passe oublié et changement de mot de passe." },
			{ slug: "securite/double-authentification", title: "Double authentification", description: "Protéger un compte avec un code sur le téléphone." },
			{ slug: "securite/appareils", title: "Appareils et sessions", description: "Voir qui est connecté, et déconnecter un appareil." },
			{ slug: "securite/journal", title: "Journal d’activité", description: "Qui a fait quoi dans le cabinet." },
			{ slug: "securite/donnees", title: "Protection des données", description: "Où sont vos données et qui peut les voir." },
		],
	},
	{
		title: "Abonnement",
		pages: [
			{ slug: "abonnement/offres", title: "Offres et limites", description: "Ce que comprend chaque offre." },
			{ slug: "abonnement/passer-a-une-offre", title: "De l’essai à l’abonnement", description: "Choisir une offre, payer le devis et démarrer." },
			{ slug: "abonnement/factures", title: "Factures et renouvellement", description: "Ce qui se passe à chaque nouvelle période." },
			{ slug: "abonnement/impayes", title: "Retards et suspension", description: "Ce qui se passe quand un paiement n’arrive pas." },
		],
	},
	{
		title: "Aide",
		pages: [
			{ slug: "aide/faq", title: "Questions fréquentes", description: "Les réponses aux questions les plus courantes." },
			{ slug: "aide/support", title: "Contacter le support", description: "Comment obtenir de l’aide." },
		],
	},
];

export const ALL_DOCS = DOCS.flatMap((section) => section.pages.map((page) => ({ ...page, section: section.title })));

/** "Prise de rendez-vous" → "prise-de-rendez-vous": anchors of the headings. */
export const slugify = (text: string) =>
	text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[’']/g, "-")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

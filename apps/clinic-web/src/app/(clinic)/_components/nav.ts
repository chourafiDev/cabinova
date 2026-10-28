import type { IconType } from "react-icons";
// Heroicons v2, solid style (react-icons "Hi*"), like the Super Admin app.
import {
  HiBanknotes,
  HiCalendarDays,
  HiChartBar,
  HiClipboardDocumentList,
  HiCog6Tooth,
  HiDocumentText,
  HiIdentification,
  HiSquares2X2,
  HiUsers,
} from "react-icons/hi2";

export type NavItem = {
  title: string;
  href: string;
  icon: IconType;
  /** Not built yet: shown with a "Bientôt" placeholder page. */
  soon?: boolean;
  /** "G" then this letter jumps here (keyboard shortcuts). */
  shortcut?: string;
};

export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Cabinet",
    items: [
      { title: "Tableau de bord", href: "/", icon: HiSquares2X2, shortcut: "d" },
      { title: "Agenda", href: "/appointments", icon: HiCalendarDays, shortcut: "a", soon: true },
      { title: "Patients", href: "/patients", icon: HiUsers, shortcut: "p", soon: true },
      { title: "Consultations", href: "/consultations", icon: HiClipboardDocumentList, shortcut: "c", soon: true },
      { title: "Ordonnances", href: "/prescriptions", icon: HiDocumentText, shortcut: "o", soon: true },
    ],
  },
  {
    label: "Gestion",
    items: [
      { title: "Encaissements", href: "/payments", icon: HiBanknotes, shortcut: "e", soon: true },
      { title: "Statistiques", href: "/reports", icon: HiChartBar, soon: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Équipe", href: "/staff", icon: HiIdentification, soon: true },
      { title: "Paramètres", href: "/settings", icon: HiCog6Tooth, soon: true },
    ],
  },
];

export const allNavItems = navGroups.flatMap((g) => g.items);

/** The nav item matching the current path (longest href wins). */
export function findNavItem(pathname: string) {
  return allNavItems
    .filter((i) =>
      i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(`${i.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}

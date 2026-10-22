import type { IconType } from "react-icons";
// Heroicons v2, solid style (react-icons "Hi*"; outline versions are "HiOutline*").
import {
  HiBanknotes,
  HiCalendarDays,
  HiChartBar,
  HiClipboardDocumentList,
  HiClock,
  HiCog6Tooth,
  HiDocumentText,
  HiIdentification,
  HiSquares2X2,
  HiUsers,
} from "react-icons/hi2";
import type { Permission } from "@/lib/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: IconType;
  /** Hidden from users that lack this permission. */
  permission?: Permission;
};

export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Clinique",
    items: [
      { title: "Tableau de bord", href: "/", icon: HiSquares2X2 },
      { title: "Agenda", href: "/appointments", icon: HiCalendarDays, permission: "appointments:read" },
      { title: "Patients", href: "/patients", icon: HiUsers, permission: "patients:read" },
      { title: "Consultations", href: "/consultations", icon: HiClipboardDocumentList, permission: "emr:read" },
      { title: "Documents", href: "/documents", icon: HiDocumentText, permission: "documents:read" },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Facturation", href: "/billing", icon: HiBanknotes, permission: "billing:read" },
      { title: "Rapports", href: "/reports", icon: HiChartBar, permission: "reports:read" },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Équipe", href: "/staff", icon: HiIdentification, permission: "users:read" },
      { title: "Journal d'activité", href: "/activity", icon: HiClock, permission: "settings:read" },
      { title: "Réglages", href: "/settings", icon: HiCog6Tooth, permission: "settings:read" },
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

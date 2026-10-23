import type { IconType } from "react-icons";
// Heroicons v2, solid style (react-icons "Hi*"; outline versions are "HiOutline*").
import { HiBuildingOffice2, HiSquares2X2 } from "react-icons/hi2";
import type { Permission } from "@/lib/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: IconType;
  /** Hidden from users that lack this permission. */
  permission?: Permission;
};

// Only items with a real page are listed here. The rest of the Super Admin
// module list (Abonnements & facturation, Administration technique,
// Utilisateurs & permissions, Fonctionnalités, Support, Sécurité,
// Configuration) ships module by module — see the project plan.
export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Plateforme",
    items: [
      { title: "Tableau de bord", href: "/", icon: HiSquares2X2, permission: "dashboard:read" },
      { title: "Cabinets", href: "/tenants", icon: HiBuildingOffice2, permission: "tenants:read" },
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

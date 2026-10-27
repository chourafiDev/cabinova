import type { IconType } from "react-icons";
// Heroicons v2, solid style (react-icons "Hi*"; outline versions are "HiOutline*").
import {
  HiBanknotes,
  HiBuildingOffice2,
  HiCog6Tooth,
  HiCreditCard,
  HiLifebuoy,
  HiPuzzlePiece,
  HiServerStack,
  HiShieldCheck,
  HiSquares2X2,
  HiUserGroup,
} from "react-icons/hi2";
import type { Permission } from "@/lib/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: IconType;
  /** Hidden from users that lack this permission. */
  permission?: Permission;
};

// Grouped by what the admin is doing: the overview, the clinics and their
// requests, the commercial side, and running the platform. Items the user
// can't see are hidden; a group with none left disappears.
export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Vue d’ensemble",
    items: [{ title: "Tableau de bord", href: "/", icon: HiSquares2X2, permission: "dashboard:read" }],
  },
  {
    label: "Cabinets",
    items: [
      { title: "Cabinets", href: "/tenants", icon: HiBuildingOffice2, permission: "tenants:read" },
      { title: "Support", href: "/support", icon: HiLifebuoy, permission: "support:read" },
    ],
  },
  {
    label: "Offres et facturation",
    items: [
      { title: "Offres", href: "/plans", icon: HiCreditCard, permission: "subscriptions:read" },
      { title: "Fonctionnalités", href: "/features", icon: HiPuzzlePiece, permission: "subscriptions:read" },
      { title: "Facturation", href: "/billing", icon: HiBanknotes, permission: "billing:read" },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Technique", href: "/technical", icon: HiServerStack, permission: "technical:read" },
      { title: "Utilisateurs", href: "/users", icon: HiUserGroup, permission: "users:read" },
      { title: "Sécurité", href: "/security", icon: HiShieldCheck, permission: "security:read" },
      { title: "Configuration", href: "/settings", icon: HiCog6Tooth, permission: "settings:read" },
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

import {
  type AppIcon,
  IconBuilding,
  IconCard,
  IconDashboard,
  IconModules,
  IconMoney,
  IconPeople,
  IconServer,
  IconSettings,
  IconShieldCheck,
  IconSupport,
} from "@/components/icons";
import type { Permission } from "@/lib/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: AppIcon;
  /** Hidden from users that lack this permission. */
  permission?: Permission;
  /** "G" then this letter jumps here (keyboard shortcuts). */
  shortcut?: string;
};

// Grouped by what the admin is doing: the overview, the clinics and their
// requests, the commercial side, and running the platform. Items the user
// can't see are hidden; a group with none left disappears.
export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Vue d’ensemble",
    items: [{ title: "Tableau de bord", href: "/", icon: IconDashboard, shortcut: "d", permission: "dashboard:read" }],
  },
  {
    label: "Cabinets",
    items: [
      { title: "Cabinets", href: "/tenants", icon: IconBuilding, shortcut: "c", permission: "tenants:read" },
      { title: "Support", href: "/support", icon: IconSupport, shortcut: "s", permission: "support:read" },
    ],
  },
  {
    label: "Offres et facturation",
    items: [
      { title: "Offres", href: "/plans", icon: IconCard, shortcut: "o", permission: "subscriptions:read" },
      { title: "Fonctionnalités", href: "/features", icon: IconModules, permission: "subscriptions:read" },
      { title: "Facturation", href: "/billing", icon: IconMoney, shortcut: "f", permission: "billing:read" },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Technique", href: "/technical", icon: IconServer, shortcut: "t", permission: "technical:read" },
      { title: "Utilisateurs", href: "/users", icon: IconPeople, shortcut: "u", permission: "users:read" },
      { title: "Sécurité", href: "/security", icon: IconShieldCheck, permission: "security:read" },
      { title: "Configuration", href: "/settings", icon: IconSettings, permission: "settings:read" },
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

import type { IconType } from "react-icons";
// Heroicons v2, solid style (react-icons "Hi*"), like the Super Admin app.
import {
  HiBanknotes,
  HiCalendarDays,
  HiChartBar,
  HiCog6Tooth,
  HiIdentification,
  HiSquares2X2,
  HiUsers,
  HiVideoCamera,
} from "react-icons/hi2";

export type NavItem = {
  /** In messages/<locale>/nav.json, under items. */
  key: string;
  href: string;
  icon: IconType;
  /** "G" then this letter jumps here (keyboard shortcuts). */
  shortcut?: string;
  /** Only these roles see it (everyone when absent). */
  roles?: string[];
};

export const navGroups: { key: string; items: NavItem[] }[] = [
  {
    key: "cabinet",
    items: [
      { key: "dashboard", href: "/", icon: HiSquares2X2, shortcut: "d" },
      { key: "appointments", href: "/appointments", icon: HiCalendarDays, shortcut: "a" },
      { key: "patients", href: "/patients", icon: HiUsers, shortcut: "p" },
      { key: "meetings", href: "/meetings", icon: HiVideoCamera, shortcut: "m" },
    ],
  },
  {
    key: "management",
    items: [
      { key: "payments", href: "/payments", icon: HiBanknotes, shortcut: "e" },
      { key: "reports", href: "/reports", icon: HiChartBar, roles: ["owner", "doctor"] },
    ],
  },
  {
    key: "administration",
    items: [
      { key: "staff", href: "/staff", icon: HiIdentification, roles: ["owner"] },
      { key: "settings", href: "/settings", icon: HiCog6Tooth },
    ],
  },
];

export const allNavItems = navGroups.flatMap((g) => g.items);

/** What this person sees in the sidebar and the command palette. */
export const visibleNavItems = (items: NavItem[], role: string) =>
  items.filter((i) => !i.roles || i.roles.includes(role));

/** The nav item matching the current path (longest href wins). */
export function findNavItem(pathname: string) {
  return allNavItems
    .filter((i) =>
      i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(`${i.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}

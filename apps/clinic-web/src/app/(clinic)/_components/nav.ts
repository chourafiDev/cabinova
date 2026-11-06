import {
  type AppIcon,
  IconCalendar,
  IconChart,
  IconClock,
  IconDashboard,
  IconIdCard,
  IconSettings,
  IconSun,
  IconUserCheck,
  IconUsers,
  IconVideo,
  IconWallet,
} from "@/components/icons";

export type NavItem = {
  /** In messages/<locale>/nav.json, under items. */
  key: string;
  href: string;
  icon: AppIcon;
  /** "G" then this letter jumps here (keyboard shortcuts). */
  shortcut?: string;
  /** Only these roles see it (everyone when absent). */
  roles?: string[];
};

export const navGroups: { key: string; items: NavItem[] }[] = [
  {
    key: "cabinet",
    items: [
      { key: "dashboard", href: "/", icon: IconDashboard, shortcut: "d" },
      { key: "absences", href: "/absences", icon: IconSun, shortcut: "c" },
      { key: "patients", href: "/patients", icon: IconUsers, shortcut: "p" },
      { key: "meetings", href: "/meetings", icon: IconVideo, shortcut: "m" },
    ],
  },
  // The three tabs of the Agenda page, one click away each.
  {
    key: "agenda",
    items: [
      { key: "calendar", href: "/appointments?tab=agenda", icon: IconCalendar, shortcut: "a" },
      { key: "waiting", href: "/appointments?tab=waiting", icon: IconClock, shortcut: "s" },
      { key: "seen", href: "/appointments?tab=seen", icon: IconUserCheck, shortcut: "v" },
    ],
  },
  {
    key: "management",
    items: [
      { key: "payments", href: "/payments", icon: IconWallet, shortcut: "e" },
      { key: "reports", href: "/reports", icon: IconChart, roles: ["owner", "doctor"] },
    ],
  },
  {
    key: "administration",
    items: [
      { key: "staff", href: "/staff", icon: IconIdCard, roles: ["owner"] },
      { key: "settings", href: "/settings", icon: IconSettings },
    ],
  },
];

export const allNavItems = navGroups.flatMap((g) => g.items);

/** What this person sees in the sidebar and the command palette. */
export const visibleNavItems = (items: NavItem[], role: string) =>
  items.filter((i) => !i.roles || i.roles.includes(role));

/**
 * The Agenda page's open tab, as the page decides it: the one in the URL,
 * else the agenda when a link targets it (a date, a view, a booking), else
 * the waiting room.
 */
const agendaTab = (search: URLSearchParams) =>
  search.get("tab") ?? (search.has("view") || search.has("date") || search.has("book") ? "agenda" : "waiting");

/** The nav item matching the current page (longest path wins; the Agenda's by its tab). */
export function findNavItem(pathname: string, search: URLSearchParams = new URLSearchParams()) {
  return allNavItems
    .filter((i) => {
      const [path, query] = i.href.split("?");
      if (query) return pathname === path && new URLSearchParams(query).get("tab") === agendaTab(search);
      return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
    })
    .sort((a, b) => b.href.length - a.href.length)[0];
}

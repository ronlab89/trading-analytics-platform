import {
  Activity,
  ArrowLeftRight,
  Briefcase,
  ChartColumn,
  Globe,
  History,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface Destination {
  path: string;
  /** Key under `nav` in the i18n resources. */
  labelKey: `nav.${"home" | "portfolios" | "transactions" | "analytics" | "markets" | "decisions" | "activity" | "settings"}`;
  icon: LucideIcon;
}

/** The seven views of the activity bar, in the order of the Figma design. */
export const DESTINATIONS: readonly Destination[] = [
  { path: "/", labelKey: "nav.home", icon: LayoutDashboard },
  { path: "/portfolios", labelKey: "nav.portfolios", icon: Briefcase },
  { path: "/transactions", labelKey: "nav.transactions", icon: ArrowLeftRight },
  { path: "/analytics", labelKey: "nav.analytics", icon: ChartColumn },
  { path: "/markets", labelKey: "nav.markets", icon: Globe },
  { path: "/decisions", labelKey: "nav.decisions", icon: History },
  { path: "/activity", labelKey: "nav.activity", icon: Activity },
];

/** Settings sits apart, at the bottom of the activity bar. */
export const SETTINGS_DESTINATION: Destination = {
  path: "/settings",
  labelKey: "nav.settings",
  icon: Settings,
};

export const SETTINGS_SECTIONS = ["profile", "preferences", "demo"] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SETTINGS_SECTION: SettingsSection = "profile";

/** Demo mode only says something in the demo build; a real account has nothing to show there. */
export const sectionsFor = (mode: "real" | "demo"): readonly SettingsSection[] =>
  SETTINGS_SECTIONS.filter((section) => section !== "demo" || mode === "demo");

export const isSettingsSection = (
  value: string | null,
  available: readonly SettingsSection[] = SETTINGS_SECTIONS,
): value is SettingsSection => available.some((section) => section === value);

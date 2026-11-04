export const SETTINGS_SECTIONS = ["profile", "preferences", "demo"] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SETTINGS_SECTION: SettingsSection = "profile";

export const isSettingsSection = (value: string | null): value is SettingsSection =>
  SETTINGS_SECTIONS.some((section) => section === value);

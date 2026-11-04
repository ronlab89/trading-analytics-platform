import { FlaskConical, SlidersHorizontal, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { SETTINGS_SECTIONS, type SettingsSection } from "../lib/settings-sections";

const ICONS = { profile: User, preferences: SlidersHorizontal, demo: FlaskConical } as const;

interface SettingsNavProps {
  section: SettingsSection;
  onSelect: (section: SettingsSection) => void;
  /** Tablet and phone: the sections are tabs, because 240 px of menu do not fit a narrow screen. */
  tabs: boolean;
}

/**
 * How the sections of Settings are chosen, as the Figma draws them: a menu on the side of the
 * desktop, where the current item is dark like a current tab, and tabs on top of the narrow screens.
 */
export function SettingsNav({ section, onSelect, tabs }: SettingsNavProps) {
  const { t } = useTranslation();
  const label = t("settings.nav.label");

  if (tabs) {
    return (
      <Tabs
        onValueChange={(value) => {
          const next = SETTINGS_SECTIONS.find((candidate) => candidate === value);
          if (next !== undefined) onSelect(next);
        }}
        value={section}
      >
        <TabsList aria-label={label} className="w-full">
          {SETTINGS_SECTIONS.map((entry) => (
            <TabsTrigger className="flex-1" key={entry} value={entry}>
              {t(`settings.sections.${entry}.title`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    );
  }

  return (
    <nav aria-label={label} className="flex flex-col gap-1">
      {SETTINGS_SECTIONS.map((entry) => {
        const Icon = ICONS[entry];
        const current = entry === section;
        return (
          <button
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-button-focus-ring)",
              current
                ? "bg-(--color-button-primary-background) text-(--color-button-primary-foreground)"
                : "text-(--color-text-secondary) hover:text-(--color-text-default)",
            )}
            key={entry}
            onClick={() => {
              onSelect(entry);
            }}
            type="button"
          >
            <Icon aria-hidden="true" className="size-4" />
            {t(`settings.sections.${entry}.title`)}
          </button>
        );
      })}
    </nav>
  );
}

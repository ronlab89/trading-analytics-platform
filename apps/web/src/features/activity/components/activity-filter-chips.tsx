import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatCalendarRange } from "@/lib/format-date";
import {
  activePanelFilterCount,
  NO_PANEL_FILTERS,
  SEVERITIES,
  SOURCES,
  type ActivityPanelFilters,
} from "../lib/activity-panel-filters";

interface ActivityFilterChipsProps {
  /** The filters in force. */
  value: ActivityPanelFilters;
  onChange: (filters: ActivityPanelFilters) => void;
}

/**
 * The Figma row under the search: one chip for each group of filters that narrows the list, each
 * with its "x" to remove just that group, and "Limpiar todo". With nothing to show it takes no
 * room at all.
 */
export function ActivityFilterChips({ value, onChange }: ActivityFilterChipsProps) {
  const { t, i18n } = useTranslation();
  if (activePanelFilterCount(value) === 0) return null;

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (value.severities.length > 0 && value.severities.length < SEVERITIES.length) {
    chips.push({
      key: "severity",
      label: t("activityFilters.chips.severity", {
        value: value.severities.map((severity) => t(`activity.severity.${severity}`)).join(", "),
      }),
      clear: () => {
        onChange({ ...value, severities: [] });
      },
    });
  }
  if (value.sources.length > 0 && value.sources.length < SOURCES.length) {
    chips.push({
      key: "source",
      label: t("activityFilters.chips.source", {
        value: value.sources.map((source) => t(`activity.source.${source}`)).join(", "),
      }),
      clear: () => {
        onChange({ ...value, sources: [] });
      },
    });
  }
  if (value.range) {
    chips.push({
      key: "range",
      label: t("activityFilters.chips.date", {
        value: formatCalendarRange(value.range.from, value.range.to, i18n.language),
      }),
      clear: () => {
        onChange({ ...value, range: null });
      },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul aria-label={t("activityFilters.chips.list")} className="contents">
        {chips.map(({ key, label, clear }) => (
          <li
            className="inline-flex h-8 items-center gap-2 rounded-md bg-(--color-surface-secondary) pr-1 pl-3 text-sm text-(--color-text-default)"
            key={key}
          >
            {label}
            <Button
              aria-label={t("activityFilters.chips.remove", { filter: label })}
              onClick={clear}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        onClick={() => {
          onChange(NO_PANEL_FILTERS);
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        {t("activityFilters.clearAll")}
      </Button>
    </div>
  );
}

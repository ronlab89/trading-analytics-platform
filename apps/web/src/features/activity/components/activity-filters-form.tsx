import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CheckboxItem } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { DateRangeField } from "@/features/transactions/components/transaction-filters-form";
import { cn } from "@/lib/utils";
import type { ActivitySeverity, ActivitySource } from "../lib/activity-events";
import {
  NO_PANEL_FILTERS,
  samePanelFilters,
  SEVERITIES,
  SOURCES,
  type ActivityPanelFilters,
} from "../lib/activity-panel-filters";

interface ActivityFiltersFormProps {
  /** The filters in force; the form starts from them and "Aplicar filtros" waits for a change. */
  value: ActivityPanelFilters;
  onApply: (filters: ActivityPanelFilters) => void;
  onCancel: () => void;
  /** The panel (a title with "Limpiar todo", and "Cancelar") or the mobile sheet ("Limpiar"). */
  layout?: "panel" | "sheet";
  /** Months the date calendar shows side by side; the container knows how much room there is. */
  months?: 1 | 2 | undefined;
  /** The day "today" means for the date presets; a test fixes it. */
  today?: Date | undefined;
}

function toggled<T>(list: readonly T[], item: T, checked: boolean): T[] {
  return checked ? [...list, item] : list.filter((chosen) => chosen !== item);
}

/**
 * The content of the Figma "Filtros" of the activity: the severity, the source and the date range.
 * What is chosen is a draft: nothing narrows the list until "Aplicar filtros", which stays off
 * until the draft asks for something different from what is already in force.
 */
export function ActivityFiltersForm({
  value,
  onApply,
  onCancel,
  layout = "panel",
  months,
  today,
}: ActivityFiltersFormProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const isSheet = layout === "sheet";
  const changed = !samePanelFilters(draft, value);
  const clearable = draft.severities.length + draft.sources.length > 0 || draft.range !== null;

  const clear = () => {
    setDraft(NO_PANEL_FILTERS);
  };

  return (
    <form
      className="flex flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft);
      }}
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-sm font-medium text-(--color-text-default)">
          {t("activityFilters.title")}
        </h2>
        {isSheet ? null : (
          <Button
            className="text-(--color-text-secondary) enabled:text-(--color-text-default)"
            disabled={!clearable}
            onClick={clear}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("activityFilters.clearAll")}
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-(--color-text-default)">
            {t("activityFilters.severity")}
          </legend>
          <div className={cn("grid gap-2", isSheet ? "grid-cols-1" : "grid-cols-2")}>
            {SEVERITIES.map((severity: ActivitySeverity) => (
              <CheckboxItem
                checked={draft.severities.includes(severity)}
                key={severity}
                label={t(`activity.severity.${severity}`)}
                onCheckedChange={(checked) => {
                  setDraft((current) => ({
                    ...current,
                    severities: toggled(current.severities, severity, checked === true),
                  }));
                }}
              />
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-(--color-text-default)">
            {t("activityFilters.source")}
          </legend>
          <div className={cn("grid gap-2", isSheet ? "grid-cols-1" : "grid-cols-2")}>
            {SOURCES.map((source: ActivitySource) => (
              <CheckboxItem
                checked={draft.sources.includes(source)}
                key={source}
                label={t(`activity.source.${source}`)}
                onCheckedChange={(checked) => {
                  setDraft((current) => ({
                    ...current,
                    sources: toggled(current.sources, source, checked === true),
                  }));
                }}
              />
            ))}
          </div>
        </fieldset>
        <Field label={t("activityFilters.date")}>
          <DateRangeField
            months={months}
            onChange={(range) => {
              setDraft((current) => ({ ...current, range }));
            }}
            placeholder={t(isSheet ? "activityFilters.selectRange" : "activityFilters.anyDate")}
            // Two months beside the panel only where there is room for both; elsewhere it opens below.
            side={!isSheet && months === 2 ? "right" : "bottom"}
            today={today}
            value={draft.range}
          />
        </Field>
      </div>
      <div
        className={cn(
          "flex items-center justify-end gap-2 border-t border-(--color-border-default) px-4 py-3",
          isSheet && "*:flex-1",
        )}
      >
        {isSheet ? (
          <Button disabled={!clearable} onClick={clear} type="button" variant="ghost">
            {t("activityFilters.clear")}
          </Button>
        ) : (
          <Button onClick={onCancel} type="button" variant="outline">
            {t("activityFilters.cancel")}
          </Button>
        )}
        <Button disabled={!changed} type="submit">
          {t("activityFilters.apply")}
        </Button>
      </div>
    </form>
  );
}

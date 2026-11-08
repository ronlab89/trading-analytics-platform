import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import { formatMomentDay } from "@/lib/format-date";
import type { ScenarioRow } from "../types";
import { ScenarioImpact, ScenarioValue, useMainChangeLabel } from "./scenario-parts";

/**
 * The mobile scenarios: one white card whose rows are the scenarios. Each row has the symbol of the
 * main asset, the name with the main variable and the day it was edited under it, and the value
 * with the scenario with its impact under it.
 */
export function ScenarioCardList({ rows }: { rows: readonly ScenarioRow[] }) {
  const { t, i18n } = useTranslation();
  const mainChangeLabel = useMainChangeLabel();

  return (
    <ul
      aria-label={t("scenarios.table")}
      className="flex flex-col overflow-hidden rounded-xl bg-(--color-surface-card)"
    >
      {rows.map((row) => (
        <li
          className="flex items-center gap-3 border-b border-(--color-border-default) px-4 py-3 last:border-b-0"
          key={row.id}
        >
          <Avatar initials={row.mainChange?.symbol ?? "—"} shape="square" size="lg" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-sm leading-5 font-medium text-(--color-text-default)">
              {row.name}
            </span>
            <span className="truncate text-xs leading-4 text-(--color-text-secondary)">
              {mainChangeLabel(row)} · {formatMomentDay(row.updatedAt, i18n.language)}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1 text-sm leading-5 text-(--color-text-default)">
            <ScenarioValue row={row} />
            <ScenarioImpact row={row} />
          </span>
        </li>
      ))}
    </ul>
  );
}

import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { formatMomentDay } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-number";
import {
  ScenarioFigure,
  ScenarioImpact,
  ScenarioValue,
  ScenarioVariableChip,
} from "../components/scenario-parts";
import { ScenarioRowMenu } from "../components/scenario-row-menu";
import type { ScenarioRow, ScenarioRowActions } from "../types";

const column = createColumnHelper<DataTableFeatures, ScenarioRow>();

type ColumnKey = "name" | "variable" | "base" | "withScenario" | "edited" | "impact";

/** The tablet drops the two values, which are the most detail; the mobile cards show the rest. */
const DESKTOP_ONLY = "max-desktop:hidden";

/** A header is a component, not a string, so it follows the language without rebuilding the columns. */
function headerOf(key: ColumnKey) {
  return function Header() {
    const { t } = useTranslation();
    return t(`scenarios.columns.${key}`);
  };
}

/** The Figma header of the menu column is blank; screen readers still get a name for it. */
const ActionsHeader = function ActionsHeader() {
  const { t } = useTranslation();
  return <span className="sr-only">{t("scenarios.columns.actions")}</span>;
};

function EditedCell({ updatedAt }: { updatedAt: string }) {
  const { i18n } = useTranslation();
  return <span>{formatMomentDay(updatedAt, i18n.language)}</span>;
}

/** What the sort reads of a figure: the number, and a scenario without one goes last either way. */
const withScenarioOf = (row: ScenarioRow) =>
  row.figures === null ? undefined : Number(row.figures.withScenario.amount);

/**
 * The columns of the scenarios table, as the Figma draws them. The list is loaded whole, so the
 * columns sort in the client. The search reads the name column, which holds the name of the
 * scenario and the symbol of its main variable. The menu column is only there when the view has
 * something to do with a scenario. The columns depend on nothing but the actions, so they are built
 * once, which the table needs to stay stable.
 */
export function useScenarioColumns(actions?: ScenarioRowActions) {
  return useMemo(
    () =>
      column.columns([
        column.accessor((row) => `${row.name} ${row.mainChange?.symbol ?? ""}`.trim(), {
          id: "name",
          header: headerOf("name"),
          meta: { rowHeader: true },
          cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
        }),
        column.accessor((row) => row.mainChange?.symbol ?? "", {
          id: "variable",
          header: headerOf("variable"),
          enableGlobalFilter: false,
          cell: ({ row }) => <ScenarioVariableChip row={row.original} />,
        }),
        column.accessor(
          (row) => (row.figures === null ? undefined : Number(row.figures.base.amount)),
          {
            id: "base",
            header: headerOf("base"),
            enableGlobalFilter: false,
            sortUndefined: "last",
            meta: { align: "end", className: DESKTOP_ONLY },
            cell: ({ row }) => (
              <ScenarioFigure row={row.original}>
                {(figures) => <span>{formatMoney(figures.base)}</span>}
              </ScenarioFigure>
            ),
          },
        ),
        column.accessor(withScenarioOf, {
          id: "withScenario",
          header: headerOf("withScenario"),
          enableGlobalFilter: false,
          sortUndefined: "last",
          meta: { align: "end", className: DESKTOP_ONLY },
          cell: ({ row }) => <ScenarioValue row={row.original} />,
        }),
        column.accessor("updatedAt", {
          id: "edited",
          header: headerOf("edited"),
          enableGlobalFilter: false,
          meta: { align: "end" },
          cell: ({ getValue }) => <EditedCell updatedAt={getValue()} />,
        }),
        column.accessor((row) => row.figures?.impactPercent ?? undefined, {
          id: "impact",
          header: headerOf("impact"),
          enableGlobalFilter: false,
          sortUndefined: "last",
          cell: ({ row }) => <ScenarioImpact row={row.original} />,
        }),
        ...(actions === undefined
          ? []
          : [
              column.display({
                id: "actions",
                header: ActionsHeader,
                meta: { align: "end" },
                cell: ({ row }) => <ScenarioRowMenu actions={actions} scenario={row.original} />,
              }),
            ]),
      ]),
    [actions],
  );
}

import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Avatar } from "@/components/avatar";
import type { DecisionRow } from "../types";
import { DecisionDirectionBadge, DecisionStatusBadge } from "./decision-badges";

/**
 * The mobile decisions: one white card whose rows are the decisions. Each row has the asset's
 * symbol, the title with its direction under it, and the status with the outcome under it. The
 * prices are left out, as the Figma does for the narrow widths. The whole row is a link to the
 * decision.
 */
export function DecisionCardList({ rows }: { rows: readonly DecisionRow[] }) {
  const { t } = useTranslation();

  return (
    <ul
      aria-label={t("decisions.table")}
      className="flex flex-col overflow-hidden rounded-xl bg-(--color-surface-card)"
    >
      {rows.map((row) => (
        <li className="border-b border-(--color-border-default) last:border-b-0" key={row.id}>
          <Link
            className="flex items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            to={`/decisions/${row.id}`}
          >
            <Avatar initials={row.symbol ?? "—"} shape="square" size="lg" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm leading-5 font-medium text-(--color-text-default)">
                {row.title}
              </span>
              <span className="flex items-center gap-2">
                <DecisionDirectionBadge direction={row.direction} />
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <DecisionStatusBadge status={row.status} />
              {row.outcome === null ? null : (
                <span className="text-xs leading-4 font-medium text-(--color-text-secondary)">
                  {row.outcome}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

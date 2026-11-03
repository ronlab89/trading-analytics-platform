import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { DecisionRow } from "../types";
import { DecisionDirectionBadge, DecisionStatusBadge } from "./decision-badges";

/**
 * The top line of a decision's detail, as the Figma draws it: the way back to the list at the left
 * and the direction and status of the decision at the right.
 */
export function DecisionDetailHeader({
  direction,
  status,
}: Pick<DecisionRow, "direction" | "status">) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link
        className="inline-flex items-center gap-2 text-sm text-(--color-text-default) hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        to="/decisions"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("decisions.detail.back")}
      </Link>
      <div className="flex items-center gap-2">
        <DecisionDirectionBadge direction={direction} />
        <DecisionStatusBadge status={status} />
      </div>
    </div>
  );
}

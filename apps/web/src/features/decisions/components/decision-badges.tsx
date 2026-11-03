import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import type { DecisionRow } from "../types";

/** The way the decision leans, as a quiet badge: long, short or neutral. */
export function DecisionDirectionBadge({ direction }: Pick<DecisionRow, "direction">) {
  const { t } = useTranslation();

  return <Badge>{t(`decisions.direction.${direction}`)}</Badge>;
}

/** Open decisions are orange, because they still wait for an outcome; closed ones are quiet. */
export function DecisionStatusBadge({ status }: Pick<DecisionRow, "status">) {
  const { t } = useTranslation();

  return (
    <Badge tone={status === "OPEN" ? "warning" : "neutral"}>
      {t(`decisions.status.${status}`)}
    </Badge>
  );
}

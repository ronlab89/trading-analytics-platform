import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import type { AlertRow } from "../lib/alert-row";

/** "Above" or "Below"; a condition this view does not know is written as the API gave it. */
export function AlertCondition({ condition }: Pick<AlertRow, "condition">) {
  const { t } = useTranslation();
  return t(`alerts.condition.${condition}`, { defaultValue: condition });
}

/** Whether the alert watches the price (success) or is paused (neutral). */
export function AlertStatus({ enabled }: Pick<AlertRow, "enabled">) {
  const { t } = useTranslation();
  return (
    <Badge tone={enabled ? "success" : "neutral"}>
      {t(enabled ? "alerts.status.active" : "alerts.status.paused")}
    </Badge>
  );
}

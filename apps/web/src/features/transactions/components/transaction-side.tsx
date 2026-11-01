import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TransactionRow } from "../types";

/** The Figma "Side indicator": a buy brings the asset in (default text), a sale takes it out (secondary text). */
const appearance = {
  BUY: { Icon: ArrowDownLeft, color: "text-(--color-side-indicator-inflow-foreground)" },
  SELL: { Icon: ArrowUpRight, color: "text-(--color-side-indicator-outflow-foreground)" },
} as const satisfies Record<TransactionRow["type"], object>;

/** The type of a transaction with its arrow; the table and the mobile cards write it the same way. */
export function TransactionSide({ type }: Pick<TransactionRow, "type">) {
  const { t } = useTranslation();
  const { Icon, color } = appearance[type];

  return (
    <span className={`inline-flex items-center gap-1 text-xs leading-4 ${color}`}>
      <Icon aria-hidden="true" className="size-3" />
      {t(`transactions.type.${type}`)}
    </span>
  );
}

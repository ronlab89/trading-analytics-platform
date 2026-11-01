import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { TransactionRow } from "../types";

/** The Figma "Side indicator": a buy brings the asset in (default text), a sale takes it out (secondary text). */
const appearance = {
  BUY: {
    Icon: ArrowDownLeft,
    color: "text-(--color-side-indicator-inflow-foreground)",
    marker: "bg-current",
  },
  SELL: {
    Icon: ArrowUpRight,
    color: "text-(--color-side-indicator-outflow-foreground)",
    marker: "border border-current",
  },
} as const satisfies Record<TransactionRow["type"], object>;

interface TransactionSideProps extends Pick<TransactionRow, "type"> {
  /**
   * `sm` is the mobile card's: the arrow and the name in 12 px. `md` is the table's: a dot (filled
   * for a buy, a ring for a sale), the arrow and the name in 14 px medium.
   */
  size?: "sm" | "md";
}

/** The type of a transaction with its arrow; the table and the mobile cards write it the same way. */
export function TransactionSide({ type, size = "sm" }: TransactionSideProps) {
  const { t } = useTranslation();
  const { Icon, color, marker } = appearance[type];
  const medium = size === "md";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        medium ? "text-sm leading-5 font-medium" : "text-xs leading-4",
        color,
      )}
    >
      {medium ? (
        <span aria-hidden="true" className={cn("size-[7px] rounded-full", marker)} />
      ) : null}
      <Icon aria-hidden="true" className={medium ? "size-3.5" : "size-3"} />
      {t(`transactions.type.${type}`)}
    </span>
  );
}

import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatMoney, formatQuantity } from "@/lib/format-number";
import type { TransactionImpact } from "../lib/transaction-impact";

interface TransactionImpactSummaryProps {
  impact: TransactionImpact;
  /** The symbol of the asset, for the position line. */
  symbol: string;
}

function Row({
  label,
  children,
  strong,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-(--color-text-secondary)">{label}</dt>
      <dd className={strong ? "font-medium" : undefined}>{children}</dd>
    </div>
  );
}

/**
 * The Figma "Resumen del impacto": what the transaction costs and what it does to the position,
 * under the form. The cash balance line of the design is left out: the API has no cash.
 */
export function TransactionImpactSummary({ impact, symbol }: TransactionImpactSummaryProps) {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t("transactionImpact.title")}
      className="flex flex-col gap-2 rounded-md bg-(--color-surface-secondary) p-3 text-sm text-(--color-text-default)"
    >
      <h3 className="font-medium">{t("transactionImpact.title")}</h3>
      <dl className="flex flex-col gap-2">
        <Row
          label={t("transactionImpact.operation", {
            quantity: formatQuantity(impact.quantity),
            price: formatMoney(impact.price),
          })}
        >
          {formatMoney(impact.operation)}
        </Row>
        <Row label={t("transactionImpact.fees")}>{formatMoney(impact.fees)}</Row>
        <Row label={t("transactionImpact.total")} strong>
          {formatMoney(impact.total)}
        </Row>
        {impact.position ? (
          <Row label={t("transactionImpact.position", { symbol })}>
            <span className="inline-flex items-center gap-1">
              {formatQuantity(impact.position.from)}
              <ArrowRight aria-hidden="true" className="size-3.5" />
              <span className="sr-only"> {t("transactionImpact.to")} </span>
              {formatQuantity(impact.position.to)}
            </span>
          </Row>
        ) : null}
      </dl>
    </section>
  );
}

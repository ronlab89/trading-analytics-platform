import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { TransactionCardList } from "@/features/transactions/components/transaction-card-list";
import { TransactionDate } from "@/features/transactions/components/transaction-date";
import { TransactionDetailPanel } from "@/features/transactions/components/transaction-detail-panel";
import { TransactionSide } from "@/features/transactions/components/transaction-side";
import { TransactionStatusBadge } from "@/features/transactions/components/transaction-status-badge";
import type { TransactionRow } from "@/features/transactions/types";
import { useIsMobile } from "@/hooks/use-media-query";
import { formatMoney, formatQuantity } from "@/lib/format-number";
import { cn } from "@/lib/utils";

interface RecentTransactionsPanelProps {
  /** The latest transactions, newest first, as the overview sends them. */
  rows: readonly TransactionRow[];
  /** Opens the "Nueva transacción" panel, which the page owns. */
  onNew: () => void;
}

/** The tablet drops the quantity and price column, which is the most detail. */
const DESKTOP_ONLY = "max-desktop:hidden";

/**
 * The Figma "Transacciones recientes": the latest transactions of the portfolio with a link to the
 * whole history. From the tablet width up it is a small table; on a phone it is the same list of
 * cards the transactions screen has, and tapping one opens its detail. The Figma also writes a
 * "TX-…" code under each date, which the API does not have.
 */
export function RecentTransactionsPanel({ rows, onNew }: RecentTransactionsPanelProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [viewing, setViewing] = useState<TransactionRow | null>(null);
  const title = t("dashboard.recent.title");

  return (
    <section
      aria-labelledby="dashboard-recent-title"
      className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2
            className="text-lg leading-6 font-medium text-(--color-text-default)"
            id="dashboard-recent-title"
          >
            {title}
          </h2>
          {rows.length > 0 ? (
            <p className="text-xs text-(--color-text-secondary)">
              {t("dashboard.recent.subtitle", { count: rows.length })}
            </p>
          ) : null}
        </div>
        {rows.length > 0 ? (
          <Button asChild size="sm">
            <Link to="/transactions">{t("dashboard.recent.viewAll")}</Link>
          </Button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <PortfoliosEmptyState
          action={
            <Button onClick={onNew} size="sm" variant="outline">
              <Plus aria-hidden="true" />
              {t("transactions.new")}
            </Button>
          }
          description={t("dashboard.recent.empty.description")}
          title={t("dashboard.recent.empty.title")}
        />
      ) : isMobile ? (
        <TransactionCardList onView={setViewing} rows={rows} />
      ) : (
        <Table aria-label={title}>
          <TableHeader>
            <TableRow className="h-auto">
              <TableHead>{t("transactions.columns.asset")}</TableHead>
              <TableHead>{t("transactions.columns.date")}</TableHead>
              <TableHead>{t("transactions.columns.type")}</TableHead>
              <TableHead className={cn("text-right", DESKTOP_ONLY)}>
                {t("dashboard.recent.quantityAtPrice")}
              </TableHead>
              <TableHead className="text-right">{t("dashboard.recent.amount")}</TableHead>
              <TableHead>{t("transactions.columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <th className="px-3 text-left font-normal" scope="row">
                  <span className="flex items-center gap-3">
                    <Avatar initials={row.symbol ?? "—"} shape="square" size="lg" />
                    <span>{row.name ?? t("transactions.unknownAsset")}</span>
                  </span>
                </th>
                <TableCell>
                  <TransactionDate executedAt={row.executedAt} />
                </TableCell>
                <TableCell>
                  <TransactionSide type={row.type} />
                </TableCell>
                <TableCell className={cn("text-right font-medium", DESKTOP_ONLY)}>
                  {t("dashboard.recent.quantityAtPriceValue", {
                    quantity: formatQuantity(row.quantity),
                    price: formatMoney(row.price),
                  })}
                </TableCell>
                <TableCell className="text-right font-medium">{formatMoney(row.total)}</TableCell>
                <TableCell>
                  <TransactionStatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <TransactionDetailPanel
        onClose={() => {
          setViewing(null);
        }}
        transaction={viewing}
      />
    </section>
  );
}

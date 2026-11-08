import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatFullDateTime } from "@/lib/format-date";
import { formatMoney, formatQuantity } from "@/lib/format-number";
import { transactionNetTotal } from "../lib/transaction-total";
import type { TransactionRow } from "../types";
import { DRAWER } from "./drawer-class";
import { TransactionSide } from "./transaction-side";
import { TransactionStatusBadge } from "./transaction-status-badge";

interface TransactionDetailPanelProps {
  /** The transaction to show; the panel is open while there is one. */
  transaction: TransactionRow | null;
  onClose: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-(--color-border-default) py-3 text-sm">
      <dt className="text-(--color-text-secondary)">{label}</dt>
      <dd className="text-right font-medium text-(--color-text-default)">{children}</dd>
    </div>
  );
}

/**
 * The Figma "Detalle de la transacción": a drawer with what the API knows about one transaction.
 * The list already carries all of it, so the panel reads the row it was opened from and asks for
 * nothing. The Figma also shows the position and the cash before and after, and a transaction id
 * in "TX-…" form and the delete action: the API sends none of them, so they are not drawn.
 */
export function TransactionDetailPanel({ transaction, onClose }: TransactionDetailPanelProps) {
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={transaction !== null}
    >
      <DialogContent className={DRAWER} mobileSheet>
        {transaction ? <TransactionDetail transaction={transaction} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TransactionDetail({ transaction }: { transaction: TransactionRow }) {
  const { t, i18n } = useTranslation();
  const { type, symbol, name, quantity, price, fees, total, status, executedAt } = transaction;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("transactionDetail.title")}</DialogTitle>
        <DialogDescription>{formatFullDateTime(executedAt, i18n.language)}</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex-1">
        <dl className="flex flex-col">
          <Row label={t("transactionDetail.type")}>
            <TransactionSide size="md" type={type} />
          </Row>
          <Row label={t("transactionDetail.asset")}>
            {symbol && name ? `${symbol} · ${name}` : (name ?? t("transactions.unknownAsset"))}
          </Row>
          <Row label={t("transactionDetail.quantity")}>
            {t("transactionDetail.units", { quantity: formatQuantity(quantity) })}
          </Row>
          <Row label={t("transactionDetail.price")}>{formatMoney(price)}</Row>
          <Row label={t("transactionDetail.operation")}>{formatMoney(total)}</Row>
          <Row label={t("transactionDetail.fees")}>{formatMoney(fees)}</Row>
          <Row label={t("transactionDetail.total")}>
            {formatMoney(transactionNetTotal(type, total, fees))}
          </Row>
          <Row label={t("transactionDetail.status")}>
            <TransactionStatusBadge status={status} />
          </Row>
        </dl>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {t("transactionDetail.close")}
          </Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

import type { AssetResponse, CreateTransactionResponse } from "@trading/contracts";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatMoney, formatQuantity } from "@/lib/format-number";
import { transactionImpact } from "../lib/transaction-impact";

/**
 * The Figma success toast of a recorded transaction: "Transacción registrada" and what was
 * recorded, with the total the impact summary showed. The response only carries the asset id, so
 * the symbol comes from the asset the user picked.
 */
export function useAnnounceRecorded() {
  const { t } = useTranslation();

  return ({ transaction }: CreateTransactionResponse, asset: AssetResponse) => {
    const impact = transactionImpact({
      type: transaction.type,
      quantity: String(transaction.quantity),
      price: transaction.price.amount,
      fees: transaction.fees.amount,
      currency: transaction.price.currency,
      held: undefined,
    });

    toast.success(t("transactionForm.recorded.title"), {
      description: t("transactionForm.recorded.description", {
        type: t(`transactions.type.${transaction.type}`),
        quantity: formatQuantity(transaction.quantity),
        symbol: asset.symbol,
        total: impact ? formatMoney(impact.total) : formatMoney(transaction.price),
      }),
    });
  };
}

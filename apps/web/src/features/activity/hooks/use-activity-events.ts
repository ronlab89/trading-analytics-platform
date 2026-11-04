import type { TransactionResponse } from "@trading/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNotifications } from "@/features/dashboard/hooks/use-notifications";
import { transactionDisplayStatus } from "@/features/transactions/lib/transaction-status";
import { toTransactionRow } from "@/features/transactions/lib/transaction-row";
import type { TransactionRow } from "@/features/transactions/types";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { useAssets } from "@/hooks/use-assets";
import { formatMoney, formatQuantity } from "@/lib/format-number";
import { toActivityEvents } from "../lib/activity-events";
import { useRecentTransactions } from "./use-recent-transactions";

const NO_TRANSACTIONS: readonly TransactionResponse[] = [];

/**
 * Everything the activity screen lists, in one place: the alerts of the user and the last 30 days
 * of transactions of the active portfolio, with the words of each transaction in the active
 * language. It waits for all of it, and it fails if any part fails, because a list that silently
 * lacks its transactions would read as a quiet month. An asset that does not load only costs its
 * symbol. With no portfolio there are no transactions to ask for, and the alerts stand alone.
 */
export function useActivityEvents() {
  const { t } = useTranslation();
  const portfolios = useActivePortfolio();
  const notifications = useNotifications();
  const portfolioId = portfolios.active?.id;
  const transactions = useRecentTransactions(portfolioId);
  const { assets, isPending: assetsPending } = useAssets(
    transactions.data?.map(({ assetId }) => assetId) ?? [],
  );

  const isError = portfolios.isError || notifications.isError || transactions.isError;
  const isPending =
    !isError &&
    (portfolios.isPending ||
      notifications.isPending ||
      (portfolioId !== undefined && transactions.isPending) ||
      assetsPending);

  const ready = !isError && !isPending;
  const loaded = ready ? (transactions.data ?? NO_TRANSACTIONS) : NO_TRANSACTIONS;

  const events = useMemo(() => {
    if (!ready) return undefined;
    return toActivityEvents({
      notifications: notifications.data ?? [],
      transactions: loaded,
      describeTransaction: (transaction) => {
        const symbol = assets.get(transaction.assetId)?.symbol ?? t("transactions.unknownAsset");
        return {
          title: t(`activity.transaction.title.${transaction.type}`, { symbol }),
          message: t("activity.transaction.message", {
            quantity: formatQuantity(transaction.quantity),
            price: formatMoney(transaction.price),
            status: t(`transactions.status.${transactionDisplayStatus(transaction.status)}`),
          }),
        };
      },
    });
  }, [ready, notifications.data, loaded, assets, t]);

  const transactionRows = useMemo(
    () =>
      new Map<string, TransactionRow>(
        loaded.map((transaction) => [
          transaction.id,
          toTransactionRow(transaction, assets.get(transaction.assetId)),
        ]),
      ),
    [loaded, assets],
  );

  const retry = () => {
    if (portfolios.isError) portfolios.retry();
    if (notifications.isError) void notifications.refetch();
    if (transactions.isError) void transactions.refetch();
  };

  return { events, transactionRows, isPending, isError, retry };
}

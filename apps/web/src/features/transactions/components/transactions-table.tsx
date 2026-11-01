import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTable } from "@/components/data-table/use-data-table";
import { useTransactionColumns } from "../hooks/use-transaction-columns";
import type { TransactionRow } from "../types";

function transactionId(row: TransactionRow) {
  return row.id;
}

/**
 * The transactions of one page, as a table. The server pages the list, so the table neither pages
 * nor sorts: it draws the rows it is given, in the order it gets them. The pagination bar and the
 * loading, empty and error states belong to the page.
 */
export function TransactionsTable({ rows }: { rows: readonly TransactionRow[] }) {
  const { t } = useTranslation();
  const table = useDataTable({
    columns: useTransactionColumns(),
    data: rows,
    getRowId: transactionId,
  });

  return <DataTable aria-label={t("transactions.table")} table={table} />;
}

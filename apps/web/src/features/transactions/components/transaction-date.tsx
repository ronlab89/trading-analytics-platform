import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/lib/format-date";

type TransactionDateProps = Omit<ComponentProps<"time">, "children" | "dateTime"> & {
  /** The ISO 8601 instant the API sends. */
  executedAt: string;
};

/**
 * The moment of a transaction in the active language, in a `time` element that keeps the instant
 * for machines. The table and the mobile cards write it the same way.
 */
export function TransactionDate({ executedAt, ...props }: TransactionDateProps) {
  const { i18n } = useTranslation();

  return (
    <time dateTime={executedAt} {...props}>
      {formatDateTime(executedAt, i18n.language)}
    </time>
  );
}

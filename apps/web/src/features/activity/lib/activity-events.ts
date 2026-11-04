import type { NotificationResponse, TransactionResponse } from "@trading/contracts";

export type ActivitySeverity = NotificationResponse["severity"];

/** Where an event comes from: the transactions of the portfolio, or the alerts (notifications) of the user. */
export type ActivitySource = "TRANSACTION" | "ALERT";

export interface ActivityEvent {
  /** Unique across sources: `notification:<id>` or `transaction:<id>`. */
  id: string;
  source: ActivitySource;
  severity: ActivitySeverity;
  title: string;
  message: string;
  /** An ISO timestamp. */
  occurredAt: string;
  /** Set for a transaction event, so the row can lead to it. */
  transactionId?: string;
}

interface TransactionDescription {
  title: string;
  message: string;
}

interface ActivityInput {
  notifications: readonly NotificationResponse[];
  transactions: readonly TransactionResponse[];
  /** The words of a transaction: the model has no language, the caller does. */
  describeTransaction: (transaction: TransactionResponse) => TransactionDescription;
}

const TRANSACTION_SEVERITY: Record<TransactionResponse["status"], ActivitySeverity> = {
  COMPLETED: "SUCCESS",
  FAILED: "ERROR",
  PROCESSING: "INFO",
  VALIDATING: "INFO",
  DRAFT: "INFO",
};

/**
 * One list of events out of the notifications and the transactions, newest first. A transaction is
 * dated when it was executed. Events with the same time keep a fixed order (by id), so the list
 * does not shuffle between two reads.
 */
export function toActivityEvents({
  notifications,
  transactions,
  describeTransaction,
}: ActivityInput): ActivityEvent[] {
  const fromNotifications = notifications.map((notification): ActivityEvent => ({
    id: `notification:${notification.id}`,
    source: "ALERT",
    severity: notification.severity,
    title: notification.title,
    message: notification.message,
    occurredAt: notification.createdAt,
  }));
  const fromTransactions = transactions.map((transaction): ActivityEvent => {
    const { title, message } = describeTransaction(transaction);
    return {
      id: `transaction:${transaction.id}`,
      source: "TRANSACTION",
      severity: TRANSACTION_SEVERITY[transaction.status],
      title,
      message,
      occurredAt: transaction.executedAt,
      transactionId: transaction.id,
    };
  });

  return [...fromNotifications, ...fromTransactions].sort(
    (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.id.localeCompare(b.id),
  );
}

export interface ActivityFilters {
  /** Empty means all of them. */
  severities: readonly ActivitySeverity[];
  /** Empty means all of them. */
  sources: readonly ActivitySource[];
  /** A day, `YYYY-MM-DD`, included. */
  dateFrom?: string;
  /** A day, `YYYY-MM-DD`, included. */
  dateTo?: string;
  search: string;
}

export const NO_ACTIVITY_FILTERS: ActivityFilters = { severities: [], sources: [], search: "" };

/** The day of a moment as the user lives it, in their time zone, as `YYYY-MM-DD`. */
export function localDay(moment: Date | string): string {
  const date = typeof moment === "string" ? new Date(moment) : moment;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/** The events that pass every filter; the order is kept. */
export function filterEvents(
  events: readonly ActivityEvent[],
  { severities, sources, dateFrom, dateTo, search }: ActivityFilters,
): ActivityEvent[] {
  const needle = search.trim().toLowerCase();

  return events.filter((event) => {
    if (severities.length > 0 && !severities.includes(event.severity)) return false;
    if (sources.length > 0 && !sources.includes(event.source)) return false;
    const day = localDay(event.occurredAt);
    if (dateFrom !== undefined && day < dateFrom) return false;
    if (dateTo !== undefined && day > dateTo) return false;
    if (needle === "") return true;
    return `${event.title} ${event.message}`.toLowerCase().includes(needle);
  });
}

export interface ActivityDay {
  /** `YYYY-MM-DD`, in the time zone of the user. */
  day: string;
  label: "today" | "yesterday" | "date";
  events: ActivityEvent[];
}

/** The events by the day they happened, the way the user reads them: today, yesterday, then dates. */
export function groupByDay(events: readonly ActivityEvent[], now: Date): ActivityDay[] {
  const today = localDay(now);
  const yesterday = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const days: ActivityDay[] = [];

  for (const event of events) {
    const day = localDay(event.occurredAt);
    const last = days.at(-1);
    if (last?.day === day) {
      last.events.push(event);
    } else {
      days.push({
        day,
        label: day === today ? "today" : day === yesterday ? "yesterday" : "date",
        events: [event],
      });
    }
  }
  return days;
}

export interface ActivityPage {
  items: ActivityEvent[];
  page: number;
  pageCount: number;
  total: number;
  /** The position of the first and the last event of the page in the whole list, from 1; 0 when empty. */
  from: number;
  to: number;
}

/** One page of the list. A page that does not exist is the nearest one that does. */
export function paginateEvents(
  events: readonly ActivityEvent[],
  page: number,
  pageSize: number,
): ActivityPage {
  const total = events.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  const items = events.slice(start, start + pageSize);

  return {
    items,
    page: current,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + items.length,
  };
}

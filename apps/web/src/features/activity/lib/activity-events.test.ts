import type { NotificationResponse, TransactionResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import {
  filterEvents,
  groupByDay,
  NO_ACTIVITY_FILTERS,
  paginateEvents,
  toActivityEvents,
  type ActivityEvent,
} from "./activity-events";

const usd = (amount: string) => ({ amount, currency: "USD" });

const notification = (
  id: string,
  severity: NotificationResponse["severity"],
  createdAt: string,
  title = `Notification ${id}`,
): NotificationResponse => ({
  id,
  userId: "u1",
  type: "ALERT",
  title,
  message: `Message of ${id}`,
  severity,
  readAt: null,
  createdAt,
  metadata: {},
});

const transaction = (
  id: string,
  status: TransactionResponse["status"],
  executedAt: string,
): TransactionResponse => ({
  id,
  portfolioId: "p1",
  assetId: "a1",
  type: "BUY",
  quantity: 15,
  price: usd("129.30"),
  fees: usd("1.00"),
  realizedPnL: null,
  status,
  executedAt,
  createdAt: executedAt,
});

const describeTransaction = (tx: TransactionResponse) => ({
  title: "Transaction recorded",
  message: `Bought ${String(tx.quantity)} of ${tx.assetId}`,
});

const built = (notifications: NotificationResponse[], transactions: TransactionResponse[] = []) =>
  toActivityEvents({ notifications, transactions, describeTransaction });

describe("toActivityEvents", () => {
  it("turns a notification into an alert event with its own severity, title and message", () => {
    const [event] = built([notification("n1", "WARNING", "2026-11-04T12:00:00.000Z", "Risk")]);

    expect(event).toMatchObject({
      id: "notification:n1",
      source: "ALERT",
      severity: "WARNING",
      title: "Risk",
      message: "Message of n1",
      occurredAt: "2026-11-04T12:00:00.000Z",
    });
  });

  it("turns a transaction into a transaction event described by the caller, at the time it was executed", () => {
    const [event] = built([], [transaction("t1", "COMPLETED", "2026-11-04T10:00:00.000Z")]);

    expect(event).toMatchObject({
      id: "transaction:t1",
      source: "TRANSACTION",
      title: "Transaction recorded",
      message: "Bought 15 of a1",
      occurredAt: "2026-11-04T10:00:00.000Z",
      transactionId: "t1",
    });
  });

  it.each([
    ["COMPLETED", "SUCCESS"],
    ["FAILED", "ERROR"],
    ["PROCESSING", "INFO"],
    ["VALIDATING", "INFO"],
    ["DRAFT", "INFO"],
  ] as const)("gives a %s transaction the severity %s", (status, severity) => {
    const [event] = built([], [transaction("t1", status, "2026-11-04T10:00:00.000Z")]);

    expect(event?.severity).toBe(severity);
  });

  it("puts the newest first, whatever the source, and keeps equal times in a fixed order", () => {
    const events = built(
      [
        notification("n1", "INFO", "2026-11-04T09:00:00.000Z"),
        notification("n2", "INFO", "2026-11-04T11:00:00.000Z"),
      ],
      [
        transaction("t1", "COMPLETED", "2026-11-04T10:00:00.000Z"),
        transaction("t2", "COMPLETED", "2026-11-04T11:00:00.000Z"),
      ],
    );

    expect(events.map(({ id }) => id)).toEqual([
      "notification:n2",
      "transaction:t2",
      "transaction:t1",
      "notification:n1",
    ]);
  });
});

const sample = built(
  [
    notification("n1", "WARNING", "2026-11-04T12:00:00.000Z", "Risk threshold exceeded"),
    notification("n2", "ERROR", "2026-11-03T12:00:00.000Z", "Sync failed"),
    notification("n3", "INFO", "2026-10-20T12:00:00.000Z", "Prices updated"),
  ],
  [transaction("t1", "COMPLETED", "2026-11-04T10:00:00.000Z")],
);

describe("filterEvents", () => {
  it("keeps everything when there is no filter", () => {
    expect(filterEvents(sample, NO_ACTIVITY_FILTERS)).toEqual(sample);
  });

  it("keeps the severities asked for, and any of them", () => {
    const only = filterEvents(sample, { ...NO_ACTIVITY_FILTERS, severities: ["ERROR", "WARNING"] });

    expect(only.map(({ id }) => id)).toEqual(["notification:n1", "notification:n2"]);
  });

  it("keeps the sources asked for", () => {
    const only = filterEvents(sample, { ...NO_ACTIVITY_FILTERS, sources: ["TRANSACTION"] });

    expect(only.map(({ id }) => id)).toEqual(["transaction:t1"]);
  });

  it("keeps the days from and to, both included", () => {
    const only = filterEvents(sample, {
      ...NO_ACTIVITY_FILTERS,
      dateFrom: "2026-11-03",
      dateTo: "2026-11-04",
    });

    expect(only.map(({ id }) => id)).toEqual([
      "notification:n1",
      "transaction:t1",
      "notification:n2",
    ]);
  });

  it("takes an open range: only from, or only to", () => {
    expect(
      filterEvents(sample, { ...NO_ACTIVITY_FILTERS, dateFrom: "2026-11-04" }).map(({ id }) => id),
    ).toEqual(["notification:n1", "transaction:t1"]);
    expect(
      filterEvents(sample, { ...NO_ACTIVITY_FILTERS, dateTo: "2026-10-31" }).map(({ id }) => id),
    ).toEqual(["notification:n3"]);
  });

  it("searches the title and the message, ignoring case and the spaces around", () => {
    expect(
      filterEvents(sample, { ...NO_ACTIVITY_FILTERS, search: "  SYNC " }).map(({ id }) => id),
    ).toEqual(["notification:n2"]);
    expect(
      filterEvents(sample, { ...NO_ACTIVITY_FILTERS, search: "bought 15" }).map(({ id }) => id),
    ).toEqual(["transaction:t1"]);
  });

  it("combines the filters: every one has to hold", () => {
    const only = filterEvents(sample, {
      ...NO_ACTIVITY_FILTERS,
      severities: ["WARNING"],
      sources: ["TRANSACTION"],
    });

    expect(only).toEqual([]);
  });
});

describe("groupByDay", () => {
  const now = new Date("2026-11-04T18:00:00.000Z");

  it("groups by the day, newest day first, and calls them today, yesterday and the date", () => {
    const groups = groupByDay(sample, now);

    expect(groups.map(({ day, label }) => [day, label])).toEqual([
      ["2026-11-04", "today"],
      ["2026-11-03", "yesterday"],
      ["2026-10-20", "date"],
    ]);
    expect(groups[0]?.events.map(({ id }) => id)).toEqual(["notification:n1", "transaction:t1"]);
  });

  it("gives no group when there is no event", () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});

describe("paginateEvents", () => {
  const many: ActivityEvent[] = built(
    Array.from({ length: 25 }, (_, index) =>
      notification(
        `n${String(index)}`,
        "INFO",
        `2026-11-04T${String(index).padStart(2, "0")}:00:00.000Z`,
      ),
    ),
  );

  it("takes the page asked for and says which events of the total are in it", () => {
    const page = paginateEvents(many, 2, 10);

    expect(page.items).toHaveLength(10);
    expect(page).toMatchObject({ page: 2, pageCount: 3, total: 25, from: 11, to: 20 });
  });

  it("has a shorter last page", () => {
    const page = paginateEvents(many, 3, 10);

    expect(page.items).toHaveLength(5);
    expect(page).toMatchObject({ from: 21, to: 25 });
  });

  it("goes to the last page when the page asked for no longer exists", () => {
    expect(paginateEvents(many, 9, 10)).toMatchObject({ page: 3, from: 21, to: 25 });
    expect(paginateEvents(many, 0, 10)).toMatchObject({ page: 1, from: 1, to: 10 });
  });

  it("has one empty page when there is nothing", () => {
    expect(paginateEvents([], 1, 10)).toEqual({
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
      from: 0,
      to: 0,
    });
  });
});

import { describe, expect, it } from "vitest";
import { AlertType, Money } from "@trading/domain";
import type { Alert, Notification, TransactionalRepositories } from "@trading/domain";
import { createAlertEvaluator } from "./alert-evaluator.js";
import { capturingLogger } from "./logger.js";
import { capturingRealtimePublisher } from "./realtime-publisher.js";
import type { MarketPriceTick } from "./realtime-publisher.js";

const FIRED_AT = new Date("2026-10-24T10:00:00.000Z");

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "al1",
    userId: "u1",
    assetId: "a1",
    portfolioId: null,
    type: AlertType.PRICE,
    condition: "ABOVE",
    threshold: 100,
    enabled: true,
    armed: true,
    lastTriggeredAt: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  };
}

function tick(price: string, assetId = "a1"): MarketPriceTick {
  const money = Money.of(price, "USD");
  return {
    assetId,
    price: money,
    previousPrice: money,
    change: Money.zero("USD"),
    changePercent: 0,
    tickChange: Money.zero("USD"),
  };
}

function build(initial: Alert[] = [alert()], options: { failNotification?: boolean } = {}) {
  const rows = new Map(initial.map((row) => [row.id, row]));
  const notifications: Notification[] = [];
  const publisher = capturingRealtimePublisher();
  const logger = capturingLogger();

  const stored = (id: string): Alert => {
    const row = rows.get(id);
    if (!row) throw new Error(`missing ${id}`);
    return row;
  };

  const alerts = {
    listEnabledByAssetIds: (assetIds: readonly string[]) =>
      Promise.resolve(
        [...rows.values()].filter(
          (row) => row.enabled && row.assetId !== null && assetIds.includes(row.assetId),
        ),
      ),
    getById: (id: string) => Promise.resolve(rows.get(id) ?? null),
    update: (id: string, input: Partial<Alert>) => {
      const next = { ...stored(id), ...input };
      rows.set(id, next);
      return Promise.resolve(next);
    },
  };
  const notificationRepository = {
    create: (input: Omit<Notification, "id" | "readAt" | "createdAt">) => {
      if (options.failNotification) {
        return Promise.reject(new Error("notification store down"));
      }
      const created = {
        ...input,
        id: `n${String(notifications.length + 1)}`,
        readAt: null,
        createdAt: FIRED_AT,
      } as Notification;
      notifications.push(created);
      return Promise.resolve(created);
    },
  };
  // Rolls the alerts back when the work throws, like the real unit of work.
  const unitOfWork = {
    async run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T> {
      const snapshot = new Map(rows);
      const sent = notifications.length;
      try {
        return await work({
          alerts: alerts as never,
          notifications: notificationRepository as never,
        } as unknown as TransactionalRepositories);
      } catch (error) {
        rows.clear();
        for (const [id, row] of snapshot) rows.set(id, row);
        notifications.length = sent;
        throw error;
      }
    },
  };

  const evaluator = createAlertEvaluator({
    alertRepository: alerts,
    assetRepository: { getByIds: () => Promise.resolve([{ id: "a1", symbol: "AAPL" } as never]) },
    unitOfWork,
    realtimePublisher: publisher,
    logger,
    now: () => FIRED_AT,
  });

  return { evaluator, rows, stored, notifications, publisher, logger };
}

describe("alert evaluator", () => {
  it("fires an armed alert when the condition turns true: state, notification and events", async () => {
    const { evaluator, rows, notifications, publisher, logger } = build();

    await evaluator.evaluate([tick("101")]);

    expect(rows.get("al1")).toMatchObject({ armed: false, lastTriggeredAt: FIRED_AT });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      userId: "u1",
      type: "ALERT_TRIGGERED",
      severity: "WARNING",
      metadata: { alertId: "al1", assetId: "a1", condition: "ABOVE", price: "101" },
    });
    expect(publisher.published.map((event) => event.type)).toEqual([
      "ALERT_TRIGGERED",
      "NOTIFICATION_CREATED",
    ]);
    expect(logger.entries.map((entry) => entry.event)).toEqual(["alert.triggered"]);
  });

  it("stays quiet on every later tick while the condition remains true", async () => {
    const { evaluator, notifications, publisher } = build();

    await evaluator.evaluate([tick("101")]);
    await evaluator.evaluate([tick("102")]);
    await evaluator.evaluate([tick("150")]);

    expect(notifications).toHaveLength(1);
    expect(publisher.published).toHaveLength(2);
  });

  it("stays quiet between the threshold and the band, then re-arms and fires again", async () => {
    const { evaluator, rows, notifications } = build();

    await evaluator.evaluate([tick("101")]);
    await evaluator.evaluate([tick("99.8")]);
    expect(rows.get("al1")?.armed).toBe(false);

    await evaluator.evaluate([tick("99.4")]);
    expect(rows.get("al1")?.armed).toBe(true);
    expect(notifications).toHaveLength(1);

    await evaluator.evaluate([tick("101")]);
    expect(notifications).toHaveLength(2);
  });

  it("does not fire a disarmed alert after a restart", async () => {
    const { evaluator, notifications } = build([
      alert({ armed: false, lastTriggeredAt: FIRED_AT }),
    ]);

    await evaluator.evaluate([tick("120")]);

    expect(notifications).toEqual([]);
  });

  it("fires a BELOW alert", async () => {
    const { evaluator, notifications } = build([alert({ condition: "BELOW", threshold: 50 })]);

    await evaluator.evaluate([tick("49")]);

    expect(notifications).toHaveLength(1);
  });

  it("ignores alerts that are not evaluable and assets that did not tick", async () => {
    const { evaluator, notifications } = build([
      alert({ id: "volatility", type: AlertType.VOLATILITY }),
      alert({ id: "odd", condition: "CROSSES" }),
      alert({ id: "other", assetId: "a2" }),
    ]);

    await evaluator.evaluate([tick("500")]);

    expect(notifications).toEqual([]);
  });

  it("does not act on an alert that was disabled after the tick began", async () => {
    const { evaluator, rows, stored, notifications } = build();
    const original = stored("al1");
    // The list the tick read is stale: the stored row is disabled when the unit re-reads it.
    rows.set("al1", { ...original, enabled: false });

    await evaluator.evaluate([tick("101")]);

    expect(notifications).toEqual([]);
  });

  it("leaves the alert armed and logs when the notification cannot be stored", async () => {
    const { evaluator, rows, publisher, logger } = build([alert()], { failNotification: true });

    await evaluator.evaluate([tick("101")]);

    expect(rows.get("al1")).toMatchObject({ armed: true, lastTriggeredAt: null });
    expect(publisher.published).toEqual([]);
    expect(logger.entries.map((entry) => entry.event)).toEqual(["alert.evaluation_failed"]);
  });

  it("keeps the trigger when publishing fails", async () => {
    const logger = capturingLogger();
    const failing = createAlertEvaluator({
      alertRepository: { listEnabledByAssetIds: () => Promise.resolve([alert()]) },
      assetRepository: { getByIds: () => Promise.resolve([]) },
      unitOfWork: {
        run: (work) =>
          work({
            alerts: { getById: () => Promise.resolve(alert()), update: () => Promise.resolve() },
            notifications: { create: () => Promise.resolve({ id: "n1" }) },
          } as never),
      },
      realtimePublisher: {
        alertTriggered: () => Promise.reject(new Error("socket down")),
        notificationCreated: () => Promise.reject(new Error("socket down")),
      },
      logger,
    });

    await expect(failing.evaluate([tick("101")])).resolves.toBeUndefined();
    expect(logger.entries.map((entry) => entry.event)).toEqual([
      "alert.triggered",
      "realtime.publish_failed",
      "realtime.publish_failed",
    ]);
  });
});

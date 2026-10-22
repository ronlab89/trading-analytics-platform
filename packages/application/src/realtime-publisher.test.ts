import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import type { Job, Notification } from "@trading/domain";
import {
  capturingRealtimePublisher,
  noopRealtimePublisher,
  type AlertTrigger,
  type MarketPriceTick,
} from "./realtime-publisher.js";

const usd = (amount: string) => Money.of(amount, "USD");

const job = { id: "j1", status: "COMPLETED" } as Job;
const notification = { id: "n1" } as Notification;
const tick: MarketPriceTick = {
  assetId: "a1",
  price: usd("184.22"),
  previousPrice: usd("182.10"),
  change: usd("2.12"),
  changePercent: 1.16,
  tickChange: usd("0.32"),
};
const trigger: AlertTrigger = {
  alertId: "al1",
  userId: "u1",
  assetId: "a1",
  condition: "ABOVE",
  threshold: usd("200"),
  price: usd("200.15"),
};

describe("noop realtime publisher", () => {
  it("resolves every event and keeps nothing", async () => {
    await expect(
      Promise.all([
        noopRealtimePublisher.marketPriceUpdated(tick),
        noopRealtimePublisher.portfolioUpdated("p1", "TRANSACTION_COMMITTED"),
        noopRealtimePublisher.jobProgressUpdated(job),
        noopRealtimePublisher.jobCompleted(job),
        noopRealtimePublisher.jobFailed(job),
        noopRealtimePublisher.notificationCreated(notification),
        noopRealtimePublisher.alertTriggered(trigger),
      ]),
    ).resolves.toHaveLength(7);
  });
});

describe("capturing realtime publisher", () => {
  it("records each event with its arguments, in the order of the calls", async () => {
    const publisher = capturingRealtimePublisher();

    await publisher.portfolioUpdated("p1", "IMPORT_COMMITTED");
    await publisher.jobProgressUpdated(job);
    await publisher.jobCompleted(job);
    await publisher.jobFailed(job);
    await publisher.notificationCreated(notification);
    await publisher.marketPriceUpdated(tick);
    await publisher.alertTriggered(trigger);

    expect(publisher.published).toEqual([
      { type: "PORTFOLIO_UPDATED", portfolioId: "p1", reason: "IMPORT_COMMITTED" },
      { type: "JOB_PROGRESS_UPDATED", job },
      { type: "JOB_COMPLETED", job },
      { type: "JOB_FAILED", job },
      { type: "NOTIFICATION_CREATED", notification },
      { type: "MARKET_PRICE_UPDATED", tick },
      { type: "ALERT_TRIGGERED", trigger },
    ]);
  });

  it("keeps separate records per instance", async () => {
    const first = capturingRealtimePublisher();
    const second = capturingRealtimePublisher();

    await first.jobCompleted(job);

    expect(first.published).toHaveLength(1);
    expect(second.published).toHaveLength(0);
  });
});

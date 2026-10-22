import { describe, expect, it } from "vitest";
import { realtimeEventSchema } from "@trading/contracts";
import { JobFailureReason, JobStage, JobStatus, Money } from "@trading/domain";
import type { Job, Notification } from "@trading/domain";
import { createHubRealtimePublisher } from "./hub-realtime-publisher.js";
import { createRealtimeHub } from "./realtime-hub.js";

const usd = (amount: string) => Money.of(amount, "USD");

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    userId: "u1",
    portfolioId: "p1",
    type: "CSV_IMPORT",
    status: JobStatus.PROCESSING,
    stage: JobStage.APPLYING,
    attempt: 1,
    processed: 60,
    total: 100,
    failureReason: null,
    report: null,
    input: "a,b",
    queuedAt: new Date("2026-03-01T11:00:00Z"),
    deadlineAt: new Date("2026-03-01T11:05:00Z"),
    createdAt: new Date("2026-03-01T11:00:00Z"),
    updatedAt: new Date("2026-03-01T11:00:00Z"),
    finishedAt: null,
    ...overrides,
  };
}

function build() {
  const hub = createRealtimeHub({
    clock: { now: () => new Date("2026-03-01T12:00:00.000Z") },
    newId: () => "event-1",
    epoch: "boot-1",
  });
  const received: unknown[] = [];
  const socket = {
    userId: "u1",
    send: (message: unknown) => {
      received.push(message);
      return true;
    },
  };

  return { hub, socket, received, publisher: createHubRealtimePublisher(hub) };
}

describe("hub realtime publisher", () => {
  it("publishes a price tick on the market channel of its asset", async () => {
    const { hub, socket, received, publisher } = build();
    hub.subscribe(socket, "market:a1");

    await publisher.marketPriceUpdated({
      assetId: "a1",
      price: usd("184.22"),
      previousPrice: usd("182.10"),
      change: usd("2.12"),
      changePercent: 1.16,
      tickChange: usd("0.32"),
    });

    expect(realtimeEventSchema.parse(received[0])).toMatchObject({
      type: "MARKET_PRICE_UPDATED",
      channel: "market:a1",
      payload: { price: { amount: "184.22", currency: "USD" } },
    });
  });

  it("publishes a portfolio update on the channel of the portfolio", async () => {
    const { hub, socket, received, publisher } = build();
    hub.subscribe(socket, "portfolio:p1");

    await publisher.portfolioUpdated("p1", "TRANSACTION_COMMITTED");

    expect(realtimeEventSchema.parse(received[0])).toMatchObject({
      type: "PORTFOLIO_UPDATED",
      payload: { portfolioId: "p1", reason: "TRANSACTION_COMMITTED" },
    });
  });

  it("publishes the three job events on the channel of the job", async () => {
    const { hub, socket, received, publisher } = build();
    hub.subscribe(socket, "jobs:j1");

    await publisher.jobProgressUpdated(job());
    await publisher.jobCompleted(job({ status: JobStatus.COMPLETED }));
    await publisher.jobFailed(
      job({ status: JobStatus.FAILED, failureReason: JobFailureReason.INTERRUPTED }),
    );

    expect(received.map((event) => realtimeEventSchema.parse(event).type)).toEqual([
      "JOB_PROGRESS_UPDATED",
      "JOB_COMPLETED",
      "JOB_FAILED",
    ]);
  });

  it("publishes a notification and an alert to the notifications of their user only", async () => {
    const { hub, socket, received, publisher } = build();
    const strangerReceived: unknown[] = [];
    const stranger = {
      userId: "u2",
      send: (message: unknown) => {
        strangerReceived.push(message);
        return true;
      },
    };
    hub.subscribe(socket, "notifications");
    hub.subscribe(stranger, "notifications");

    await publisher.notificationCreated({ id: "n1", userId: "u1" } as Notification);
    await publisher.alertTriggered({
      alertId: "al1",
      userId: "u1",
      assetId: "a1",
      condition: "PRICE_ABOVE",
      threshold: usd("180"),
      price: usd("184.22"),
    });

    expect(received.map((event) => realtimeEventSchema.parse(event).type)).toEqual([
      "NOTIFICATION_CREATED",
      "ALERT_TRIGGERED",
    ]);
    expect(strangerReceived).toHaveLength(0);
  });
});

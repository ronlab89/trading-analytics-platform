import { describe, expect, it } from "vitest";
import type { Job } from "@trading/domain";
import {
  REALTIME_EVENT_TYPES,
  presentJobCompleted,
  presentJobFailed,
  presentJobProgressUpdated,
  presentNotificationCreated,
  presentPortfolioUpdated,
  realtimeEventSchema,
} from "./realtime-event.schema.js";

const money = (amount: string) => ({ amount, currency: "USD" });

const envelope = {
  id: "event_001",
  sequence: 1024,
  timestamp: "2026-08-29T14:30:00.000Z",
  epoch: "boot-1",
};

const samples = {
  MARKET_PRICE_UPDATED: {
    channel: "market:asset_001",
    payload: {
      assetId: "asset_001",
      price: money("184.22"),
      previousPrice: money("182.10"),
      change: money("2.12"),
      changePercent: 1.16,
      tickChange: money("0.32"),
    },
  },
  PORTFOLIO_UPDATED: {
    channel: "portfolio:portfolio_001",
    payload: { portfolioId: "portfolio_001", reason: "TRANSACTION_COMMITTED" },
  },
  JOB_PROGRESS_UPDATED: {
    channel: "jobs:job_001",
    payload: { jobId: "job_001", status: "PROCESSING", progress: { processed: 60, total: 100 } },
  },
  JOB_COMPLETED: {
    channel: "jobs:job_001",
    payload: { jobId: "job_001", status: "COMPLETED" },
  },
  JOB_FAILED: {
    channel: "jobs:job_001",
    payload: { jobId: "job_001", status: "FAILED", reason: "VALIDATION_FAILED" },
  },
  NOTIFICATION_CREATED: {
    channel: "notifications",
    payload: { notificationId: "notification_001" },
  },
  ALERT_TRIGGERED: {
    channel: "notifications",
    payload: {
      alertId: "alert_001",
      assetId: "asset_001",
      condition: "ABOVE",
      threshold: money("200.00"),
      price: money("200.15"),
    },
  },
} as const;

function event(type: keyof typeof samples, overrides: Record<string, unknown> = {}) {
  return { ...envelope, type, ...samples[type], ...overrides };
}

const job: Job = {
  id: "job_001",
  userId: "u1",
  portfolioId: "p1",
  type: "CSV_IMPORT",
  status: "PROCESSING",
  stage: "VALIDATING",
  attempt: 1,
  processed: 60,
  total: 100,
  failureReason: null,
  report: null,
  input: "symbol,type\nAAPL,BUY",
  queuedAt: new Date("2026-10-21T10:00:00.000Z"),
  deadlineAt: new Date("2026-10-21T10:05:00.000Z"),
  createdAt: new Date("2026-10-21T10:00:00.000Z"),
  updatedAt: new Date("2026-10-21T10:00:00.000Z"),
  finishedAt: null,
};

describe("realtime event catalog", () => {
  it("is exactly the seven events of version 1", () => {
    expect([...REALTIME_EVENT_TYPES].sort()).toEqual(Object.keys(samples).sort());
  });

  it.each(Object.keys(samples) as (keyof typeof samples)[])("accepts a valid %s", (type) => {
    expect(realtimeEventSchema.safeParse(event(type)).success).toBe(true);
  });

  it.each(["id", "type", "channel", "sequence", "timestamp", "payload", "epoch"])(
    "requires the %s field of the envelope",
    (field) => {
      const incomplete = Object.fromEntries(
        Object.entries(event("JOB_COMPLETED")).filter(([key]) => key !== field),
      );
      expect(realtimeEventSchema.safeParse(incomplete).success).toBe(false);
    },
  );

  it.each([
    ["an unknown event type", { type: "TRANSACTION_CREATED" }],
    ["a removed event type", { type: "POSITION_UPDATED" }],
    ["a channel of another event", { channel: "portfolio:p1" }],
    ["a malformed channel", { channel: "jobs:has space" }],
    ["a sequence of zero", { sequence: 0 }],
    ["a fractional sequence", { sequence: 1.5 }],
    ["a timestamp that is not ISO-8601", { timestamp: "yesterday" }],
    ["an empty epoch", { epoch: "" }],
  ])("rejects %s", (_name, overrides) => {
    expect(realtimeEventSchema.safeParse(event("JOB_COMPLETED", overrides)).success).toBe(false);
  });

  it("rejects a notification event on a job channel and a job event on `notifications`", () => {
    expect(
      realtimeEventSchema.safeParse(event("NOTIFICATION_CREATED", { channel: "jobs:j1" })).success,
    ).toBe(false);
    expect(
      realtimeEventSchema.safeParse(event("JOB_FAILED", { channel: "notifications" })).success,
    ).toBe(false);
  });

  it("rejects money that is not a decimal string and a failed job without a reason", () => {
    const badMoney = event("MARKET_PRICE_UPDATED", {
      payload: {
        ...samples.MARKET_PRICE_UPDATED.payload,
        price: { amount: 184.22, currency: "USD" },
      },
    });
    const noReason = event("JOB_FAILED", { payload: { jobId: "j1", status: "FAILED" } });

    expect(realtimeEventSchema.safeParse(badMoney).success).toBe(false);
    expect(realtimeEventSchema.safeParse(noReason).success).toBe(false);
  });

  it("rejects a job status or failure reason outside the domain sets", () => {
    const status = event("JOB_COMPLETED", { payload: { jobId: "j1", status: "DONE" } });
    const reason = event("JOB_FAILED", {
      payload: { jobId: "j1", status: "FAILED", reason: "BROKEN" },
    });

    expect(realtimeEventSchema.safeParse(status).success).toBe(false);
    expect(realtimeEventSchema.safeParse(reason).success).toBe(false);
  });
});

describe("realtime payload presenters", () => {
  it("presents the progress of a job without its input or owner", () => {
    const payload = presentJobProgressUpdated(job);

    expect(payload).toEqual({
      jobId: "job_001",
      status: "PROCESSING",
      progress: { processed: 60, total: 100 },
    });
    expect(JSON.stringify(payload)).not.toContain("AAPL");
  });

  it("presents a completed job", () => {
    expect(presentJobCompleted({ ...job, status: "COMPLETED" })).toEqual({
      jobId: "job_001",
      status: "COMPLETED",
    });
  });

  it("presents a failed job with its reason and refuses one without", () => {
    expect(presentJobFailed({ ...job, status: "FAILED", failureReason: "APPLY_ERROR" })).toEqual({
      jobId: "job_001",
      status: "FAILED",
      reason: "APPLY_ERROR",
    });
    expect(() => presentJobFailed({ ...job, status: "FAILED" })).toThrow(/failure reason/);
  });

  it("presents a portfolio update and a created notification by id only", () => {
    expect(presentPortfolioUpdated("p1", "IMPORT_COMMITTED")).toEqual({
      portfolioId: "p1",
      reason: "IMPORT_COMMITTED",
    });
    expect(presentNotificationCreated({ id: "n1" })).toEqual({ notificationId: "n1" });
  });
});

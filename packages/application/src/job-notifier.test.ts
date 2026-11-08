import { describe, expect, it, vi } from "vitest";
import { InvalidNotificationError } from "@trading/domain";
import type { CreateNotificationInput, Job } from "@trading/domain";
import { createJobNotifier } from "./job-notifier.js";
import { capturingLogger } from "./logger.js";
import { capturingRealtimePublisher } from "./realtime-publisher.js";

const NOW = new Date("2026-03-01T12:00:00Z");

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    userId: "u1",
    portfolioId: "p1",
    type: "CSV_IMPORT",
    status: "COMPLETED",
    stage: "APPLYING",
    attempt: 2,
    processed: 40,
    total: 40,
    failureReason: null,
    report: null,
    input: null,
    queuedAt: NOW,
    deadlineAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    finishedAt: NOW,
    ...overrides,
  };
}

function build() {
  const create = vi.fn((_input: CreateNotificationInput) => Promise.resolve({} as never));
  const notifier = createJobNotifier({ notificationRepository: { create } });
  return { notifier, create };
}

describe("job notifier", () => {
  it("tells the owner an import completed, with a SUCCESS notification", async () => {
    const { notifier, create } = build();

    await notifier.jobFinished(job());

    expect(create).toHaveBeenCalledWith({
      userId: "u1",
      type: "JOB_COMPLETED",
      title: "Import completed",
      message: "Imported 40 transactions.",
      severity: "SUCCESS",
      metadata: { jobId: "j1", portfolioId: "p1", attempt: 2 },
    });
  });

  it.each([
    ["VALIDATION_FAILED", "The file has errors. Fix them and import it again."],
    ["INTERRUPTED", "The import was interrupted. You can retry it."],
    ["APPLY_ERROR", "The import hit a technical error. You can retry it."],
    ["APPLY_REJECTED", "The import was rejected because the portfolio changed. You can retry it."],
    ["PORTFOLIO_ARCHIVED", "The portfolio was archived, so the import was not applied."],
  ] as const)(
    "tells the owner an import failed with %s, with an ERROR notification",
    async (reason, message) => {
      const { notifier, create } = build();

      await notifier.jobFinished(job({ status: "FAILED", failureReason: reason }));

      expect(create).toHaveBeenCalledWith({
        userId: "u1",
        type: "JOB_FAILED",
        title: "Import failed",
        message,
        severity: "ERROR",
        metadata: { jobId: "j1", portfolioId: "p1", attempt: 2, reason },
      });
    },
  );

  it("tells the owner an import timed out, with an ERROR notification", async () => {
    const { notifier, create } = build();

    await notifier.jobFinished(job({ status: "TIMED_OUT" }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "JOB_TIMED_OUT",
        severity: "ERROR",
        message: "The import took too long. You can retry it.",
      }),
    );
  });

  it("tells nothing for a cancelled job, because the user caused it", async () => {
    const { notifier, create } = build();

    await notifier.jobFinished(job({ status: "CANCELLED" }));

    expect(create).not.toHaveBeenCalled();
  });

  it.each(["QUEUED", "PROCESSING"] as const)(
    "tells nothing for a job that is %s",
    async (status) => {
      const { notifier, create } = build();

      await notifier.jobFinished(job({ status }));

      expect(create).not.toHaveBeenCalled();
    },
  );

  it("refuses a notification the domain would not accept", async () => {
    const { notifier, create } = build();

    await expect(notifier.jobFinished(job({ userId: " " }))).rejects.toBeInstanceOf(
      InvalidNotificationError,
    );
    expect(create).not.toHaveBeenCalled();
  });
});

describe("job notifier: realtime", () => {
  const stored = { id: "n1", userId: "u1" } as never;

  function buildPublishing(create = vi.fn(() => Promise.resolve(stored))) {
    const realtimePublisher = capturingRealtimePublisher();
    const logger = capturingLogger();
    const notifier = createJobNotifier({
      notificationRepository: { create },
      realtimePublisher,
      logger,
    });
    return { notifier, realtimePublisher, logger, create };
  }

  it("publishes NOTIFICATION_CREATED with the stored notification, after it was created", async () => {
    const { notifier, realtimePublisher } = buildPublishing();

    await notifier.jobFinished(job());

    expect(realtimePublisher.published).toEqual([
      { type: "NOTIFICATION_CREATED", notification: stored },
    ]);
  });

  it("publishes for a failed and for a timed-out job too", async () => {
    const { notifier, realtimePublisher } = buildPublishing();

    await notifier.jobFinished(job({ status: "FAILED", failureReason: "APPLY_ERROR" }));
    await notifier.jobFinished(job({ status: "TIMED_OUT" }));

    expect(realtimePublisher.published).toHaveLength(2);
  });

  it("publishes nothing for a cancelled job, which creates no notification", async () => {
    const { notifier, realtimePublisher, create } = buildPublishing();

    await notifier.jobFinished(job({ status: "CANCELLED" }));

    expect(create).not.toHaveBeenCalled();
    expect(realtimePublisher.published).toEqual([]);
  });

  it("publishes nothing when the notification could not be stored", async () => {
    const { notifier, realtimePublisher } = buildPublishing(
      vi.fn(() => Promise.reject(new Error("db down"))),
    );

    await expect(notifier.jobFinished(job())).rejects.toThrow("db down");

    expect(realtimePublisher.published).toEqual([]);
  });

  it("keeps the notification and logs a warning when the publish fails", async () => {
    const logger = capturingLogger();
    const create = vi.fn(() => Promise.resolve(stored));
    const notifier = createJobNotifier({
      notificationRepository: { create },
      realtimePublisher: { notificationCreated: () => Promise.reject(new Error("hub gone")) },
      logger,
    });

    await expect(notifier.jobFinished(job())).resolves.toBeUndefined();

    expect(create).toHaveBeenCalledTimes(1);
    expect(logger.entries).toMatchObject([
      {
        level: "warn",
        event: "realtime.publish_failed",
        fields: { event: "NOTIFICATION_CREATED", notificationId: "n1", error: "hub gone" },
      },
    ]);
  });
});

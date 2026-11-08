import { z } from "zod";
import { JobFailureReason, JobStatus } from "@trading/domain";
import type { Job, Notification } from "@trading/domain";
import { isoTimestampSchema, moneySchema } from "./response-common.schema.js";
import { resourceIdSchema } from "./params.schema.js";

/**
 * Realtime event envelope and the event catalog of version 1.
 * Source: ADR-007 points 4, 5, 6 and 15, ADR-008 point 11, 08-realtime-spec.md
 * §14 to §23.
 *
 * Every server event carries `{ id, type, channel, sequence, timestamp,
 * payload }` plus the per-process `epoch` (ADR-007 Deferred detail): a client
 * that sees the `epoch` change resets its baseline, because `sequence` restarts
 * after a server restart. Money is `{ amount: "<decimal string>", currency }`
 * (ADR-002). A new event type needs a new decision, so the catalog is closed.
 */

const jobStatusValues = Object.values(JobStatus) as [JobStatus, ...JobStatus[]];
const jobFailureReasonValues = Object.values(JobFailureReason) as [
  JobFailureReason,
  ...JobFailureReason[],
];

/** Why a portfolio changed; the payload does not carry the portfolio (the client refetches it). */
export const PORTFOLIO_UPDATE_REASONS = ["TRANSACTION_COMMITTED", "IMPORT_COMMITTED"] as const;
export type PortfolioUpdateReason = (typeof PORTFOLIO_UPDATE_REASONS)[number];

export const marketPriceUpdatedPayloadSchema = z.object({
  assetId: resourceIdSchema,
  price: moneySchema,
  // Measured against the last closed daily candle, never the previous tick (ADR-007 point 14).
  previousPrice: moneySchema,
  change: moneySchema,
  changePercent: z.number(),
  // The tick-to-tick delta; it exists only in this event.
  tickChange: moneySchema,
});

export const portfolioUpdatedPayloadSchema = z.object({
  portfolioId: resourceIdSchema,
  reason: z.enum(PORTFOLIO_UPDATE_REASONS),
});

export const jobProgressUpdatedPayloadSchema = z.object({
  jobId: resourceIdSchema,
  status: z.enum(jobStatusValues),
  progress: z.object({
    processed: z.number().int().min(0),
    total: z.number().int().min(0),
  }),
});

export const jobCompletedPayloadSchema = z.object({
  jobId: resourceIdSchema,
  status: z.enum(jobStatusValues),
});

export const jobFailedPayloadSchema = z.object({
  jobId: resourceIdSchema,
  status: z.enum(jobStatusValues),
  reason: z.enum(jobFailureReasonValues),
});

export const notificationCreatedPayloadSchema = z.object({
  notificationId: resourceIdSchema,
});

export const alertTriggeredPayloadSchema = z.object({
  alertId: resourceIdSchema,
  assetId: resourceIdSchema,
  condition: z.string().min(1),
  threshold: moneySchema,
  price: moneySchema,
});

/** The fields every server event carries, whatever its type. */
const envelopeShape = {
  id: z.string().min(1),
  sequence: z.number().int().min(1),
  timestamp: isoTimestampSchema,
  epoch: z.string().min(1),
};

const marketChannelPattern = /^market:[A-Za-z0-9_-]{1,64}$/;
const portfolioChannelPattern = /^portfolio:[A-Za-z0-9_-]{1,64}$/;
const jobsChannelPattern = /^jobs:[A-Za-z0-9_-]{1,64}$/;

export const marketPriceUpdatedEventSchema = z.object({
  ...envelopeShape,
  type: z.literal("MARKET_PRICE_UPDATED"),
  channel: z.string().regex(marketChannelPattern),
  payload: marketPriceUpdatedPayloadSchema,
});

export const portfolioUpdatedEventSchema = z.object({
  ...envelopeShape,
  type: z.literal("PORTFOLIO_UPDATED"),
  channel: z.string().regex(portfolioChannelPattern),
  payload: portfolioUpdatedPayloadSchema,
});

export const jobProgressUpdatedEventSchema = z.object({
  ...envelopeShape,
  type: z.literal("JOB_PROGRESS_UPDATED"),
  channel: z.string().regex(jobsChannelPattern),
  payload: jobProgressUpdatedPayloadSchema,
});

export const jobCompletedEventSchema = z.object({
  ...envelopeShape,
  type: z.literal("JOB_COMPLETED"),
  channel: z.string().regex(jobsChannelPattern),
  payload: jobCompletedPayloadSchema,
});

export const jobFailedEventSchema = z.object({
  ...envelopeShape,
  type: z.literal("JOB_FAILED"),
  channel: z.string().regex(jobsChannelPattern),
  payload: jobFailedPayloadSchema,
});

export const notificationCreatedEventSchema = z.object({
  ...envelopeShape,
  type: z.literal("NOTIFICATION_CREATED"),
  channel: z.literal("notifications"),
  payload: notificationCreatedPayloadSchema,
});

export const alertTriggeredEventSchema = z.object({
  ...envelopeShape,
  type: z.literal("ALERT_TRIGGERED"),
  channel: z.literal("notifications"),
  payload: alertTriggeredPayloadSchema,
});

/** The seven events of version 1; anything else is rejected. */
export const realtimeEventSchema = z.discriminatedUnion("type", [
  marketPriceUpdatedEventSchema,
  portfolioUpdatedEventSchema,
  jobProgressUpdatedEventSchema,
  jobCompletedEventSchema,
  jobFailedEventSchema,
  notificationCreatedEventSchema,
  alertTriggeredEventSchema,
]);
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
export type RealtimeEventType = RealtimeEvent["type"];

export const REALTIME_EVENT_TYPES = [
  "MARKET_PRICE_UPDATED",
  "PORTFOLIO_UPDATED",
  "JOB_PROGRESS_UPDATED",
  "JOB_COMPLETED",
  "JOB_FAILED",
  "NOTIFICATION_CREATED",
  "ALERT_TRIGGERED",
] as const satisfies readonly RealtimeEventType[];

export function presentJobProgressUpdated(job: Job) {
  return {
    jobId: job.id,
    status: job.status,
    progress: { processed: job.processed, total: job.total },
  } satisfies z.infer<typeof jobProgressUpdatedPayloadSchema>;
}

export function presentJobCompleted(job: Job) {
  return { jobId: job.id, status: job.status } satisfies z.infer<typeof jobCompletedPayloadSchema>;
}

/** A failed job always has a reason; a job that has none is not a `JOB_FAILED`. */
export function presentJobFailed(job: Job) {
  if (job.failureReason === null) {
    throw new Error("A failed job event needs the failure reason of the job.");
  }

  return {
    jobId: job.id,
    status: job.status,
    reason: job.failureReason,
  } satisfies z.infer<typeof jobFailedPayloadSchema>;
}

export function presentPortfolioUpdated(portfolioId: string, reason: PortfolioUpdateReason) {
  return { portfolioId, reason } satisfies z.infer<typeof portfolioUpdatedPayloadSchema>;
}

export function presentNotificationCreated(notification: Pick<Notification, "id">) {
  return { notificationId: notification.id } satisfies z.infer<
    typeof notificationCreatedPayloadSchema
  >;
}

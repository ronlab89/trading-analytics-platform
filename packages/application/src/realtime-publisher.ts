import type { Job, Money, Notification } from "@trading/domain";

/** Why a portfolio's holdings changed (08-realtime-spec.md §18). */
export type PortfolioUpdateReason = "TRANSACTION_COMMITTED" | "IMPORT_COMMITTED";

/**
 * One price tick of an asset. `previousPrice`, `change` and `changePercent`
 * are measured against the last closed daily candle; `tickChange` is the
 * tick-to-tick delta (ADR-007 point 14).
 */
export interface MarketPriceTick {
  readonly assetId: string;
  readonly price: Money;
  readonly previousPrice: Money;
  readonly change: Money;
  readonly changePercent: number;
  readonly tickChange: Money;
}

/** An alert whose condition changed from false to true (ADR-007 point 9). */
export interface AlertTrigger {
  readonly alertId: string;
  readonly userId: string;
  readonly assetId: string;
  readonly condition: string;
  readonly threshold: Money;
  readonly price: Money;
}

/**
 * How the application layer hands an event to the realtime adapter
 * (ADR-007 point 17). One method per event of version 1; the adapter in
 * `apps/api` turns the arguments into the wire payload, assigns the
 * `sequence` and delivers the event to the subscribed sockets.
 *
 * Services call it only after the change has committed, and treat a rejected
 * call as a failure to publish, never as a failure of the change: realtime is
 * best effort and degrades to HTTP. Version 1 has no domain events and no
 * event bus, so this is the whole hand-off.
 */
export interface RealtimePublisher {
  marketPriceUpdated: (tick: MarketPriceTick) => Promise<void>;
  portfolioUpdated: (portfolioId: string, reason: PortfolioUpdateReason) => Promise<void>;
  jobProgressUpdated: (job: Job) => Promise<void>;
  jobCompleted: (job: Job) => Promise<void>;
  jobFailed: (job: Job) => Promise<void>;
  notificationCreated: (notification: Notification) => Promise<void>;
  alertTriggered: (trigger: AlertTrigger) => Promise<void>;
}

/** A publisher that drops every event: for services that run without a socket. */
export const noopRealtimePublisher: RealtimePublisher = {
  marketPriceUpdated: () => Promise.resolve(),
  portfolioUpdated: () => Promise.resolve(),
  jobProgressUpdated: () => Promise.resolve(),
  jobCompleted: () => Promise.resolve(),
  jobFailed: () => Promise.resolve(),
  notificationCreated: () => Promise.resolve(),
  alertTriggered: () => Promise.resolve(),
};

/** One call recorded by `capturingRealtimePublisher`, in the order it was made. */
export type PublishedEvent =
  | { readonly type: "MARKET_PRICE_UPDATED"; readonly tick: MarketPriceTick }
  | {
      readonly type: "PORTFOLIO_UPDATED";
      readonly portfolioId: string;
      readonly reason: PortfolioUpdateReason;
    }
  | { readonly type: "JOB_PROGRESS_UPDATED"; readonly job: Job }
  | { readonly type: "JOB_COMPLETED"; readonly job: Job }
  | { readonly type: "JOB_FAILED"; readonly job: Job }
  | { readonly type: "NOTIFICATION_CREATED"; readonly notification: Notification }
  | { readonly type: "ALERT_TRIGGERED"; readonly trigger: AlertTrigger };

export interface CapturingRealtimePublisher extends RealtimePublisher {
  readonly published: readonly PublishedEvent[];
}

/** A publisher for tests: it records every call and resolves. */
export function capturingRealtimePublisher(): CapturingRealtimePublisher {
  const published: PublishedEvent[] = [];

  function record(event: PublishedEvent): Promise<void> {
    published.push(event);
    return Promise.resolve();
  }

  return {
    published,
    marketPriceUpdated: (tick) => record({ type: "MARKET_PRICE_UPDATED", tick }),
    portfolioUpdated: (portfolioId, reason) =>
      record({ type: "PORTFOLIO_UPDATED", portfolioId, reason }),
    jobProgressUpdated: (job) => record({ type: "JOB_PROGRESS_UPDATED", job }),
    jobCompleted: (job) => record({ type: "JOB_COMPLETED", job }),
    jobFailed: (job) => record({ type: "JOB_FAILED", job }),
    notificationCreated: (notification) => record({ type: "NOTIFICATION_CREATED", notification }),
    alertTriggered: (trigger) => record({ type: "ALERT_TRIGGERED", trigger }),
  };
}

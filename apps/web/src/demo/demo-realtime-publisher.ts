import type { RealtimePublisher } from "@trading/application";
import {
  NOTIFICATIONS_CHANNEL,
  jobsChannelName,
  marketChannelName,
  portfolioChannelName,
  presentJobCompleted,
  presentJobFailed,
  presentJobProgressUpdated,
  presentMoney,
  presentNotificationCreated,
  presentPortfolioUpdated,
} from "@trading/contracts";
import type { DemoRealtimeServer } from "./demo-realtime-server";

/**
 * The `RealtimePublisher` of the demo: it maps the domain arguments to the wire payload with the same
 * contract presenters as the API publisher and hands the event to the in-process server (ADR-007
 * point 17, ADR-012 point 7). The demo has one user, so the notification channel needs no user.
 */
export function createDemoRealtimePublisher(
  server: Pick<DemoRealtimeServer, "publish">,
): RealtimePublisher {
  return {
    marketPriceUpdated(tick) {
      server.publish({
        type: "MARKET_PRICE_UPDATED",
        channel: marketChannelName(tick.assetId),
        payload: {
          assetId: tick.assetId,
          price: presentMoney(tick.price),
          previousPrice: presentMoney(tick.previousPrice),
          change: presentMoney(tick.change),
          changePercent: tick.changePercent,
          tickChange: presentMoney(tick.tickChange),
        },
      });
      return Promise.resolve();
    },

    portfolioUpdated(portfolioId, reason) {
      server.publish({
        type: "PORTFOLIO_UPDATED",
        channel: portfolioChannelName(portfolioId),
        payload: presentPortfolioUpdated(portfolioId, reason),
      });
      return Promise.resolve();
    },

    jobProgressUpdated(job) {
      server.publish({
        type: "JOB_PROGRESS_UPDATED",
        channel: jobsChannelName(job.id),
        payload: presentJobProgressUpdated(job),
      });
      return Promise.resolve();
    },

    jobCompleted(job) {
      server.publish({
        type: "JOB_COMPLETED",
        channel: jobsChannelName(job.id),
        payload: presentJobCompleted(job),
      });
      return Promise.resolve();
    },

    jobFailed(job) {
      server.publish({
        type: "JOB_FAILED",
        channel: jobsChannelName(job.id),
        payload: presentJobFailed(job),
      });
      return Promise.resolve();
    },

    notificationCreated(notification) {
      server.publish({
        type: "NOTIFICATION_CREATED",
        channel: NOTIFICATIONS_CHANNEL,
        payload: presentNotificationCreated(notification),
      });
      return Promise.resolve();
    },

    alertTriggered(trigger) {
      server.publish({
        type: "ALERT_TRIGGERED",
        channel: NOTIFICATIONS_CHANNEL,
        payload: {
          alertId: trigger.alertId,
          assetId: trigger.assetId,
          condition: trigger.condition,
          threshold: presentMoney(trigger.threshold),
          price: presentMoney(trigger.price),
        },
      });
      return Promise.resolve();
    },
  };
}

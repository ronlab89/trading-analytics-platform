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
import type { RealtimeHub } from "./realtime-hub.js";

/**
 * The `RealtimePublisher` of the API process: it maps the domain arguments to
 * the wire payload with the contracts presenters and hands the event to the hub
 * (ADR-001, ADR-007 point 17). Delivery is synchronous and best effort, so the
 * calls resolve once the hub has taken the event.
 */
export function createHubRealtimePublisher(hub: RealtimeHub): RealtimePublisher {
  return {
    marketPriceUpdated(tick) {
      hub.publish({
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
      hub.publish({
        type: "PORTFOLIO_UPDATED",
        channel: portfolioChannelName(portfolioId),
        payload: presentPortfolioUpdated(portfolioId, reason),
      });
      return Promise.resolve();
    },

    jobProgressUpdated(job) {
      hub.publish({
        type: "JOB_PROGRESS_UPDATED",
        channel: jobsChannelName(job.id),
        payload: presentJobProgressUpdated(job),
      });
      return Promise.resolve();
    },

    jobCompleted(job) {
      hub.publish({
        type: "JOB_COMPLETED",
        channel: jobsChannelName(job.id),
        payload: presentJobCompleted(job),
      });
      return Promise.resolve();
    },

    jobFailed(job) {
      hub.publish({
        type: "JOB_FAILED",
        channel: jobsChannelName(job.id),
        payload: presentJobFailed(job),
      });
      return Promise.resolve();
    },

    notificationCreated(notification) {
      hub.publish({
        type: "NOTIFICATION_CREATED",
        channel: NOTIFICATIONS_CHANNEL,
        userId: notification.userId,
        payload: presentNotificationCreated(notification),
      });
      return Promise.resolve();
    },

    alertTriggered(trigger) {
      hub.publish({
        type: "ALERT_TRIGGERED",
        channel: NOTIFICATIONS_CHANNEL,
        userId: trigger.userId,
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

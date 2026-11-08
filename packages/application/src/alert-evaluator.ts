import {
  Money,
  NotificationSeverity,
  nextPriceAlertAction,
  priceAlertDirection,
  validateNewNotification,
} from "@trading/domain";
import type {
  Alert,
  AlertRepository,
  AssetRepository,
  Notification,
  PriceAlertAction,
  UnitOfWork,
} from "@trading/domain";
import { ALERT_EVENTS, alertLogFields } from "./alert-events.js";
import { silentLogger } from "./logger.js";
import type { Logger } from "./logger.js";
import { publishQuietly } from "./publish-quietly.js";
import type { AlertTrigger, MarketPriceTick, RealtimePublisher } from "./realtime-publisher.js";

export interface AlertEvaluator {
  /**
   * Evaluates the enabled price alerts of the ticked assets against the new
   * prices. It never rejects: a failure is logged and the next alert goes on.
   */
  evaluate(ticks: readonly MarketPriceTick[]): Promise<void>;
}

export interface AlertEvaluatorDependencies {
  alertRepository: Pick<AlertRepository, "listEnabledByAssetIds">;
  assetRepository: Pick<AssetRepository, "getByIds">;
  /** Each state change commits here, together with its notification (S2). */
  unitOfWork: UnitOfWork;
  /**
   * Publishes `ALERT_TRIGGERED` and `NOTIFICATION_CREATED` after the commit
   * (S4); without one, nothing is published. A publish that fails is logged.
   */
  realtimePublisher?: Pick<RealtimePublisher, "alertTriggered" | "notificationCreated">;
  logger?: Logger;
  now?: () => Date;
}

interface Fired {
  readonly trigger: AlertTrigger;
  readonly notification: Notification;
}

/**
 * Edge-triggered alert evaluation, run on every tick.
 * Source: ADR-007 point 9, 08-realtime-spec.md §22, FR-053.
 *
 * The rule is `nextPriceAlertAction` (domain): an armed alert fires when its
 * condition turns true, a fired one re-arms past the hysteresis band. Each
 * change runs in its own unit of work that reads the alert again, so an alert
 * that was edited, disabled or already handled since the tick began is not
 * acted on twice: `armed`, `lastTriggeredAt` and the notification commit
 * together, and the events go out after the commit.
 */
export function createAlertEvaluator(dependencies: AlertEvaluatorDependencies): AlertEvaluator {
  const {
    alertRepository,
    assetRepository,
    unitOfWork,
    realtimePublisher,
    logger = silentLogger,
    now = () => new Date(),
  } = dependencies;

  function actionFor(alert: Alert, price: Money): PriceAlertAction {
    const direction = priceAlertDirection(alert);

    return direction === null
      ? "NONE"
      : nextPriceAlertAction(direction, alert.armed, alert.threshold, price);
  }

  async function symbolsOf(assetIds: readonly string[]): Promise<Map<string, string>> {
    const assets = await assetRepository.getByIds(assetIds);

    return new Map(assets.map((asset) => [asset.id, asset.symbol]));
  }

  /** Applies one change; returns what fired, or null when nothing changed. */
  function apply(
    alertId: string,
    expected: PriceAlertAction,
    price: Money,
    symbol: string,
  ): Promise<Fired | null> {
    return unitOfWork.run(async ({ alerts, notifications }) => {
      const alert = await alerts.getById(alertId);

      if (!alert?.enabled || alert.assetId === null || actionFor(alert, price) !== expected) {
        return null;
      }

      if (expected === "REARM") {
        await alerts.update(alert.id, { armed: true });
        return null;
      }

      const threshold = Money.of(String(alert.threshold), price.currency);
      const firedAt = now();
      const input = {
        userId: alert.userId,
        type: "ALERT_TRIGGERED",
        title: `${symbol} price alert`,
        message: `${symbol} is ${alert.condition === "ABOVE" ? "above" : "below"} ${threshold.toString()} ${price.currency} at ${price.toString()} ${price.currency}.`,
        severity: NotificationSeverity.WARNING,
        metadata: {
          alertId: alert.id,
          assetId: alert.assetId,
          condition: alert.condition,
          threshold: threshold.toString(),
          price: price.toString(),
          currency: price.currency,
        },
      };
      validateNewNotification(input);

      await alerts.update(alert.id, { armed: false, lastTriggeredAt: firedAt });
      const notification = await notifications.create(input);

      return {
        notification,
        trigger: {
          alertId: alert.id,
          userId: alert.userId,
          assetId: alert.assetId,
          condition: alert.condition,
          threshold,
          price,
        },
      };
    });
  }

  async function publish({ trigger, notification }: Fired): Promise<void> {
    const fields = alertLogFields({ id: trigger.alertId, ...trigger });

    logger.info(ALERT_EVENTS.triggered, fields);

    if (!realtimePublisher) {
      return;
    }

    await publishQuietly(logger, "ALERT_TRIGGERED", fields, () =>
      realtimePublisher.alertTriggered(trigger),
    );
    await publishQuietly(
      logger,
      "NOTIFICATION_CREATED",
      { ...fields, notificationId: notification.id },
      () => realtimePublisher.notificationCreated(notification),
    );
  }

  async function evaluateTicks(ticks: readonly MarketPriceTick[]): Promise<void> {
    if (ticks.length === 0) {
      return;
    }

    const prices = new Map(ticks.map((tick) => [tick.assetId, tick.price]));
    const alerts = await alertRepository.listEnabledByAssetIds([...prices.keys()]);
    const due = alerts.flatMap((alert) => {
      const price = alert.assetId === null ? undefined : prices.get(alert.assetId);
      const action = price === undefined ? "NONE" : actionFor(alert, price);

      return price !== undefined && action !== "NONE" ? [{ alert, price, action }] : [];
    });

    if (due.length === 0) {
      return;
    }

    const symbols = await symbolsOf([
      ...new Set(due.flatMap(({ alert }) => (alert.assetId === null ? [] : [alert.assetId]))),
    ]);

    for (const { alert, price, action } of due) {
      try {
        const symbol = symbols.get(alert.assetId ?? "") ?? alert.assetId ?? "";
        const fired = await apply(alert.id, action, price, symbol);

        if (fired) {
          await publish(fired);
        }
      } catch (error) {
        logger.error(
          ALERT_EVENTS.evaluationFailed,
          alertLogFields(alert, { error: error instanceof Error ? error.message : String(error) }),
        );
      }
    }
  }

  return {
    async evaluate(ticks) {
      try {
        await evaluateTicks(ticks);
      } catch (error) {
        logger.error(ALERT_EVENTS.evaluationFailed, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}

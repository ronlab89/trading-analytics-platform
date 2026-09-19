import { AlertType } from "@trading/domain";

export interface AlertBlueprint {
  readonly type: AlertType;
  readonly condition: string;
  readonly threshold: number;
  readonly enabled: boolean;
  readonly assetSymbol?: string;
  readonly portfolioName?: string;
}

/**
 * Source: 05-data-model.md §22, 12-demo-mode-spec.md §13 ("Alerts should
 * include: active; triggered; disabled").
 *
 * The Alert entity has no separate "triggered" state field — a crossed
 * threshold is represented by pairing an alert whose threshold the
 * current seeded price has already crossed (AAPL, below) with a
 * corresponding Notification (see data/notifications.ts), not by a
 * boolean on Alert itself.
 */
export const SEED_ALERTS: readonly AlertBlueprint[] = [
  // Active — BTC ($112,450.20) has not yet crossed 120,000.
  {
    type: AlertType.PRICE,
    condition: "ABOVE",
    threshold: 120000,
    enabled: true,
    assetSymbol: "BTC",
  },
  // Already crossed — AAPL ($184.22) is above 180. Represents "triggered".
  {
    type: AlertType.PRICE,
    condition: "ABOVE",
    threshold: 180,
    enabled: true,
    assetSymbol: "AAPL",
  },
  // Manually disabled.
  {
    type: AlertType.VOLATILITY,
    condition: "ABOVE",
    threshold: 20,
    enabled: false,
    portfolioName: "Main Portfolio",
  },
];

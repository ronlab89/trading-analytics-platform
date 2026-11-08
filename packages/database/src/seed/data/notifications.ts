import { NotificationSeverity } from "@trading/domain";

export interface NotificationBlueprint {
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly severity: NotificationSeverity;
  readonly read: boolean;
}

/**
 * Source: 05-data-model.md §21, 12-demo-mode-spec.md §13. Mix of
 * severities and read/unread state to exercise notification-center UI
 * variety. The ERROR entry describes a past simulated failure — it is
 * demo/dev seed data, not a claim about the real system's reliability.
 */
export const SEED_NOTIFICATIONS: readonly NotificationBlueprint[] = [
  {
    type: "TRANSACTION_COMPLETED",
    title: "Transaction completed",
    message: "Bought 10 AAPL at $150.00.",
    severity: NotificationSeverity.SUCCESS,
    read: true,
  },
  {
    type: "TRANSACTION_COMPLETED",
    title: "Transaction completed",
    message: "Bought 0.05 BTC at $60,000.00.",
    severity: NotificationSeverity.SUCCESS,
    read: true,
  },
  {
    type: "ALERT_TRIGGERED",
    title: "Price alert triggered",
    message: "AAPL crossed above $180.00.",
    severity: NotificationSeverity.WARNING,
    read: false,
  },
  {
    type: "PORTFOLIO_CHANGE",
    title: "Portfolio updated",
    message: "Crypto Experimental value changed significantly.",
    severity: NotificationSeverity.INFO,
    read: false,
  },
  {
    type: "OPERATION_FAILED",
    title: "Transaction failed",
    message: "A previous transaction attempt failed due to a simulated timeout.",
    severity: NotificationSeverity.ERROR,
    read: false,
  },
];

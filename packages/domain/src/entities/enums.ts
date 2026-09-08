/**
 * Domain enums with no cross-entity dependencies.
 * Source: docs/05-data-model.md §5 (User) and §7 (Asset)
 */

/**
 * User role.
 * §5 — "Additional roles should only be introduced when required."
 */
export const UserRole = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Asset type.
 * §7 — "The architecture must allow additional asset types later."
 */
export const AssetType = {
  STOCK: "STOCK",
  ETF: "ETF",
  CRYPTO: "CRYPTO",
  FOREX: "FOREX",
} as const;

export type AssetType = (typeof AssetType)[keyof typeof AssetType];

/**
 * Asset status.
 * §7
 */
export const AssetStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

/**
 * Portfolio status.
 * §6 — "Archived portfolios should remain available for historical
 * analysis where appropriate."
 */
export const PortfolioStatus = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;

export type PortfolioStatus = (typeof PortfolioStatus)[keyof typeof PortfolioStatus];

/**
 * Transaction type.
 * §9 — "Future types may include DIVIDEND, FEE, DEPOSIT, WITHDRAWAL,
 * TRANSFER. These should only be introduced when the business model
 * requires them." Initial scope: BUY, SELL.
 */
export const TransactionType = {
  BUY: "BUY",
  SELL: "SELL",
} as const;

export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

/**
 * Transaction lifecycle status.
 * §10 — "Not every transaction implementation must persist every
 * intermediate state. The UI must nevertheless be able to represent
 * meaningful processing states."
 */
export const TransactionStatus = {
  DRAFT: "DRAFT",
  VALIDATING: "VALIDATING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

/**
 * Alert type.
 * §22 — explicit list defined in the data model.
 */
export const AlertType = {
  PRICE: "PRICE",
  PORTFOLIO_CHANGE: "PORTFOLIO_CHANGE",
  ALLOCATION: "ALLOCATION",
  VOLATILITY: "VOLATILITY",
} as const;

export type AlertType = (typeof AlertType)[keyof typeof AlertType];

/**
 * Notification severity.
 * §21 — explicit list defined in the data model.
 */
export const NotificationSeverity = {
  INFO: "INFO",
  SUCCESS: "SUCCESS",
  WARNING: "WARNING",
  ERROR: "ERROR",
} as const;

export type NotificationSeverity = (typeof NotificationSeverity)[keyof typeof NotificationSeverity];

/**
 * Market data source.
 * §18 — "The demo uses: MOCK." Distinguishes simulated data from a
 * real external provider, supporting the infrastructure substitution
 * principle (06-architecture.md).
 */
export const MarketDataSource = {
  MOCK: "MOCK",
  EXTERNAL: "EXTERNAL",
} as const;

export type MarketDataSource = (typeof MarketDataSource)[keyof typeof MarketDataSource];

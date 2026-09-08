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

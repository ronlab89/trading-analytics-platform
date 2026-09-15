import type { SeedContext } from "./context.js";

export function resolvePortfolioId(context: SeedContext, name: string): string {
  const portfolio = context.portfolios.find((p) => p.name === name);
  if (!portfolio) {
    throw new Error(`[seed] no seeded portfolio found with name "${name}".`);
  }
  return portfolio.id;
}

export function resolveAssetId(context: SeedContext, symbol: string): string {
  const asset = context.assets.find((a) => a.symbol === symbol);
  if (!asset) {
    throw new Error(`[seed] no seeded asset found with symbol "${symbol}".`);
  }
  return asset.id;
}

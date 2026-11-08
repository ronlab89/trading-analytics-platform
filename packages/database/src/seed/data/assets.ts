import { AssetType } from "@trading/domain";
import type { CreateAssetInput } from "@trading/domain";

/**
 * Seed asset catalog.
 *
 * Mix of STOCK/ETF/CRYPTO to exercise varied volatility profiles (needed
 * later by Step 6.3 for profitable/losing/flat positions) and to exercise
 * Decimal(18,8) precision with real crypto-scale values. FOREX is
 * intentionally omitted for now — no seeded feature currently requires it;
 * add it as its own explicit decision if that changes.
 */
export const SEED_ASSETS: readonly CreateAssetInput[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    assetType: AssetType.STOCK,
    currency: "USD",
    exchange: "NASDAQ",
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    assetType: AssetType.STOCK,
    currency: "USD",
    exchange: "NASDAQ",
  },
  {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    assetType: AssetType.STOCK,
    currency: "USD",
    exchange: "NASDAQ",
  },
  {
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    assetType: AssetType.ETF,
    currency: "USD",
    exchange: "NYSEARCA",
  },
  {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    assetType: AssetType.ETF,
    currency: "USD",
    exchange: "NASDAQ",
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    assetType: AssetType.CRYPTO,
    currency: "USD",
    exchange: "CRYPTO",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    assetType: AssetType.CRYPTO,
    currency: "USD",
    exchange: "CRYPTO",
  },
];

import type { MarketPriceResponse, RealtimeEvent } from "@trading/contracts";

export type MarketPriceUpdatedEvent = Extract<RealtimeEvent, { type: "MARKET_PRICE_UPDATED" }>;

/**
 * The prices after one `MARKET_PRICE_UPDATED`. The event carries the new price and its change since
 * the last daily close; the source of the price is not in it, so a known asset keeps the source it
 * had, and an asset that had no price yet gets the simulated market, the only one that publishes.
 *
 * An event not newer than the price we hold is ignored and the same map comes back, so a snapshot
 * read over HTTP after the tick is never taken back to an older price, and nothing re-renders.
 */
export function applyPriceUpdate(
  prices: ReadonlyMap<string, MarketPriceResponse>,
  event: MarketPriceUpdatedEvent,
): ReadonlyMap<string, MarketPriceResponse> {
  const { assetId, price, previousPrice, change, changePercent } = event.payload;
  const current = prices.get(assetId);
  if (current && Date.parse(event.timestamp) <= Date.parse(current.timestamp)) return prices;

  const next = new Map(prices);
  next.set(assetId, {
    source: "MOCK",
    ...current,
    assetId,
    price,
    previousPrice,
    change,
    changePercent,
    timestamp: event.timestamp,
  });
  return next;
}

import type { PositionResponse } from "@trading/contracts";
import type { MarketPriceUpdatedEvent } from "@/features/watchlist/lib/apply-price-update";

/**
 * The positions after one `MARKET_PRICE_UPDATED`: each position of that asset takes the new price
 * as its current price. A position has no price timestamp, so an event not newer than the moment
 * the position was last written is ignored, as a snapshot read after the tick must not be taken
 * back. When nothing changes the same array comes back, so nothing re-renders.
 */
export function applyPriceToPositions(
  positions: readonly PositionResponse[],
  event: MarketPriceUpdatedEvent,
): readonly PositionResponse[] {
  const { assetId, price } = event.payload;
  const arrivedAt = Date.parse(event.timestamp);

  const next = positions.map((position) =>
    position.assetId === assetId && arrivedAt > Date.parse(position.updatedAt)
      ? { ...position, currentPrice: price }
      : position,
  );

  return next.every((position, index) => position === positions[index]) ? positions : next;
}

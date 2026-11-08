import {
  presentPortfolioMetrics,
  presentPositionMetrics,
  type OverviewResponse,
  type PositionResponse,
} from "@trading/contracts";
import {
  Money,
  calculatePortfolioMetrics,
  calculatePositionMetrics,
  type Portfolio,
  type Position,
} from "@trading/domain";
import { applyPriceToPositions } from "@/features/portfolios/lib/apply-price-to-positions";
import type { MarketPriceUpdatedEvent } from "@/features/watchlist/lib/apply-price-update";

/** The part of the overview a price changes. */
type PricedOverview = Pick<OverviewResponse, "portfolio" | "summary" | "positions">;

const toMoney = ({ amount, currency }: { amount: string; currency: string }) =>
  Money.of(amount, currency);

/** The position the API sent as the input the domain calculations read: dates and money, not text. */
function toDomainPosition(position: PositionResponse): Position {
  return {
    ...position,
    averageEntryPrice: toMoney(position.averageEntryPrice),
    currentPrice: toMoney(position.currentPrice),
    openedAt: new Date(position.openedAt),
    updatedAt: new Date(position.updatedAt),
  };
}

function toDomainPortfolio(portfolio: OverviewResponse["portfolio"]): Portfolio {
  return {
    ...portfolio,
    createdAt: new Date(portfolio.createdAt),
    updatedAt: new Date(portfolio.updatedAt),
  };
}

/**
 * The overview after one `MARKET_PRICE_UPDATED`: each position of that asset takes the new price,
 * its metrics are calculated again, and so is the summary (total value and unrealized P/L), with the
 * same domain calculations the API uses. Everything else the overview holds (daily change,
 * allocation, attribution, pulse) needs data the client does not have, so it stays as the server
 * sent it until the next read. When the tick changes nothing, or the numbers cannot be calculated,
 * the same overview comes back.
 */
export function applyPriceToOverview<T extends PricedOverview>(
  overview: T,
  event: MarketPriceUpdatedEvent,
): T {
  const before = overview.positions.map(({ position }) => position);
  const after = applyPriceToPositions(before, event);
  if (after.every((position, index) => position === before[index])) return overview;

  try {
    const positions = overview.positions.map((entry, index) => {
      const position = after[index];
      return position === undefined || position === entry.position
        ? entry
        : {
            ...entry,
            position,
            metrics: presentPositionMetrics(calculatePositionMetrics(toDomainPosition(position))),
          };
    });
    const summary = presentPortfolioMetrics(
      calculatePortfolioMetrics(
        toDomainPortfolio(overview.portfolio),
        positions.map(({ position }) => toDomainPosition(position)),
      ),
    );
    return { ...overview, positions, summary };
  } catch {
    // A price the domain refuses (a zero cost basis, mixed currencies) is the server's to explain.
    return overview;
  }
}

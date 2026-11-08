import type { MoneyDto } from "@trading/contracts";

/** What the portfolio list shows of a portfolio. */
export interface PortfolioRow {
  id: string;
  name: string;
  baseCurrency: string;
  status: "ACTIVE" | "ARCHIVED";
}

/** What the positions table shows of a position; the symbol and name are null if the asset did not load. */
export interface PositionRow {
  id: string;
  symbol: string | null;
  name: string | null;
  quantity: number;
  averageEntryPrice: MoneyDto;
  currentPrice: MoneyDto;
}

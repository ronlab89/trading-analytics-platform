/** What the portfolio list shows of a portfolio. */
export interface PortfolioRow {
  id: string;
  name: string;
  baseCurrency: string;
  status: "ACTIVE" | "ARCHIVED";
}

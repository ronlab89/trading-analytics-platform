const TEMPLATE_LINES = [
  "symbol,type,quantity,price,fees,executedAt",
  "AAPL,BUY,10,150.25,1.00,2026-01-05",
  "AAPL,SELL,4,171.80,,2026-02-12T15:30:00Z",
];

/**
 * The example file the import dialog offers: the header with every column the API knows and two
 * rows that show the formats (a date alone, a date with time and zone, an empty fee). `price` is
 * in the portfolio's base currency.
 */
export function importTemplate(): string {
  return TEMPLATE_LINES.join("\n") + "\n";
}

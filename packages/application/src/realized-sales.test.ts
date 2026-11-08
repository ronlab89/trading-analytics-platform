import { describe, expect, it } from "vitest";
import { Money, TransactionStatus, TransactionType } from "@trading/domain";
import type { Transaction } from "@trading/domain";
import { buildRealizedByTransaction } from "./realized-sales.js";

function trade(
  id: string,
  assetId: string,
  type: TransactionType,
  executedAt: string,
  quantity: number,
  price: string,
  fees = "0",
  status: TransactionStatus = TransactionStatus.COMPLETED,
): Transaction {
  return {
    id,
    portfolioId: "p1",
    assetId,
    type,
    quantity,
    price: Money.of(price, "USD"),
    fees: Money.of(fees, "USD"),
    status,
    executedAt: new Date(`${executedAt}T00:00:00Z`),
    createdAt: new Date(`${executedAt}T00:00:00Z`),
  };
}

const buy = (
  id: string,
  assetId: string,
  day: string,
  quantity: number,
  price: string,
  fees = "0",
) => trade(id, assetId, TransactionType.BUY, day, quantity, price, fees);
const sell = (
  id: string,
  assetId: string,
  day: string,
  quantity: number,
  price: string,
  fees = "0",
) => trade(id, assetId, TransactionType.SELL, day, quantity, price, fees);

const amounts = (map: ReadonlyMap<string, Money>) =>
  Object.fromEntries([...map].map(([id, money]) => [id, money.toString()]));

describe("buildRealizedByTransaction", () => {
  it("should realize each SELL against the average cost at its sale, net of fees", () => {
    // docs/16-analytics-spec.md §12: BUY 10 @ 10 (fees 1), SELL 4 @ 11.5 (fees 1) = 4.6.
    const result = buildRealizedByTransaction(
      [
        buy("b1", "a1", "2026-06-01", 10, "10", "1"),
        sell("s1", "a1", "2026-06-03", 4, "11.5", "1"),
      ],
      "USD",
    );

    expect(amounts(result)).toEqual({ s1: "4.6" });
  });

  it("should hold nothing for a BUY", () => {
    const result = buildRealizedByTransaction([buy("b1", "a1", "2026-06-01", 10, "10")], "USD");

    expect(result.size).toBe(0);
  });

  it("should replay each asset on its own", () => {
    const result = buildRealizedByTransaction(
      [
        buy("b1", "a1", "2026-06-01", 10, "10"),
        buy("b2", "a2", "2026-06-01", 10, "100"),
        sell("s1", "a1", "2026-06-02", 2, "12"),
        sell("s2", "a2", "2026-06-02", 2, "90"),
      ],
      "USD",
    );

    expect(amounts(result)).toEqual({ s1: "4", s2: "-20" });
  });

  it("should move the sales recorded before a backdated BUY", () => {
    // Recorded: BUY d1 10 @ 10, SELL d4 5 @ 12, then BUY d2 10 @ 20: the average at the SELL is 15.
    const result = buildRealizedByTransaction(
      [
        buy("b1", "a1", "2026-06-01", 10, "10"),
        sell("s1", "a1", "2026-06-04", 5, "12"),
        buy("b2", "a1", "2026-06-02", 10, "20"),
      ],
      "USD",
    );

    expect(amounts(result)).toEqual({ s1: "-15" });
  });

  it("should leave out a transaction that is not COMPLETED", () => {
    const result = buildRealizedByTransaction(
      [
        buy("b1", "a1", "2026-06-01", 10, "10"),
        trade(
          "s1",
          "a1",
          TransactionType.SELL,
          "2026-06-02",
          2,
          "12",
          "0",
          TransactionStatus.DRAFT,
        ),
      ],
      "USD",
    );

    expect(result.size).toBe(0);
  });

  it("should be empty without transactions", () => {
    expect(buildRealizedByTransaction([], "USD").size).toBe(0);
  });
});

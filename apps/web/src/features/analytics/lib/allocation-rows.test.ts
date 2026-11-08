import { describe, expect, it } from "vitest";
import { toAllocationRows } from "./allocation-rows";

const group = (key: string, amount: string, percentage: number) => ({
  key,
  label: key.toUpperCase(),
  marketValue: { amount, currency: "USD" },
  percentage,
});

describe("toAllocationRows", () => {
  it("lists the largest group first", () => {
    const result = toAllocationRows([
      group("ko", "15052.00", 12),
      group("aapl", "42646.00", 34),
      group("msft", "27595.00", 22),
    ]);

    expect(result?.rows.map((row) => row.key)).toEqual(["aapl", "msft", "ko"]);
  });

  it("adds up what the groups hold, in the currency they share", () => {
    const result = toAllocationRows([group("aapl", "42646.10", 60), group("ko", "15052.20", 40)]);

    expect(result?.invested).toEqual({ amount: "57698.30", currency: "USD" });
  });

  it("does not change the groups it is given", () => {
    const groups = [group("ko", "1.00", 10), group("aapl", "9.00", 90)];

    toAllocationRows(groups);

    expect(groups.map((entry) => entry.key)).toEqual(["ko", "aapl"]);
  });

  it("has nothing to list for an empty allocation", () => {
    expect(toAllocationRows([])).toBeNull();
  });
});

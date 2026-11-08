import { describe, expect, it } from "vitest";
import { toAttributionRows } from "./attribution-rows";

const group = (key: string, amount: string) => ({
  key,
  label: key.toUpperCase(),
  contribution: { amount, currency: "USD" },
});

describe("toAttributionRows", () => {
  it("puts what added the most first and what took the most away last", () => {
    const rows = toAttributionRows([group("nvda", "-70"), group("aapl", "430"), group("ko", "50")]);

    expect(rows?.map((row) => row.key)).toEqual(["aapl", "ko", "nvda"]);
  });

  it("says whether each one added, took away or did nothing", () => {
    const rows = toAttributionRows([group("a", "10"), group("b", "-5"), group("c", "0")]);

    expect(rows?.map((row) => row.direction)).toEqual(["GAIN", "FLAT", "LOSS"]);
  });

  it("sizes each bar against the largest contribution, whatever its sign", () => {
    const rows = toAttributionRows([group("a", "100"), group("b", "-50"), group("c", "25")]);

    expect(rows?.map((row) => row.share)).toEqual([1, 0.25, 0.5]);
  });

  it("draws no bars when nothing contributed", () => {
    const rows = toAttributionRows([group("a", "0"), group("b", "0.00")]);

    expect(rows?.map((row) => row.share)).toEqual([0, 0]);
  });

  it("does not change the groups it is given", () => {
    const groups = [group("b", "1"), group("a", "9")];

    toAttributionRows(groups);

    expect(groups.map((entry) => entry.key)).toEqual(["b", "a"]);
  });

  it("has nothing to list for a range with no groups", () => {
    expect(toAttributionRows([])).toBeNull();
  });
});

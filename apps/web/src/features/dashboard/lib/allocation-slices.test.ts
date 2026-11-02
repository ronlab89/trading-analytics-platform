import type { AllocationResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { OTHERS_KEY, toAllocationSlices } from "./allocation-slices";

function group(
  key: string,
  amount: string,
  percentage: number,
): AllocationResponse["groups"][number] {
  return { key, label: key, marketValue: { amount, currency: "USD" }, percentage };
}

describe("toAllocationSlices", () => {
  it("orders the groups from the largest to the smallest", () => {
    const slices = toAllocationSlices(
      [group("B", "20.00", 20), group("A", "50.00", 50), group("C", "30.00", 30)],
      5,
      "Others",
    );

    expect(slices.map((s) => s.key)).toEqual(["A", "C", "B"]);
  });

  it("adds up everything beyond the largest ones into a last slice", () => {
    const slices = toAllocationSlices(
      [
        group("A", "40.00", 40),
        group("B", "25.00", 25),
        group("C", "15.00", 15),
        group("D", "12.50", 12.5),
        group("E", "7.50", 7.5),
      ],
      3,
      "Others",
    );

    expect(slices.map((s) => s.key)).toEqual(["A", "B", OTHERS_KEY]);
    expect(slices[2]).toEqual({
      key: OTHERS_KEY,
      label: "Others",
      marketValue: { amount: "35.00", currency: "USD" },
      percentage: 35,
    });
  });

  it("is empty when there are no groups", () => {
    expect(toAllocationSlices([], 5, "Others")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { drawdownTicks } from "./drawdown-axis";

const points = (...drawdowns: number[]) =>
  drawdowns.map((drawdown, index) => ({ date: `2026-10-0${String(index + 1)}`, drawdown }));

describe("drawdownTicks", () => {
  it("rounds the deepest drawdown out to an even depth and halves it for the middle guide", () => {
    expect(drawdownTicks(points(0, -3, -8.4, -2))).toEqual([0, -5, -10]);
    expect(drawdownTicks(points(0, -4))).toEqual([0, -2, -4]);
  });

  it("keeps a scale when the portfolio never fell", () => {
    expect(drawdownTicks(points(0, 0, 0))).toEqual([0, -1, -2]);
  });

  it("keeps a minimum depth for a very small fall", () => {
    expect(drawdownTicks(points(0, -0.3))).toEqual([0, -1, -2]);
  });
});

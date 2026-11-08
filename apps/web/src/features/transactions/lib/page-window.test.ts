import { describe, expect, it } from "vitest";
import { pageWindow } from "./page-window";

describe("pageWindow", () => {
  it("shows every page when there are few", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("shows the first three pages, an ellipsis and the last one at the start", () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, "ellipsis", 10]);
    expect(pageWindow(2, 10)).toEqual([1, 2, 3, "ellipsis", 10]);
  });

  it("shows the current page with its neighbours in the middle", () => {
    expect(pageWindow(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
  });

  it("shows the last three pages at the end", () => {
    expect(pageWindow(10, 10)).toEqual([1, "ellipsis", 8, 9, 10]);
    expect(pageWindow(9, 10)).toEqual([1, "ellipsis", 8, 9, 10]);
  });

  it("shows the page a gap of one would hide instead of an ellipsis", () => {
    expect(pageWindow(4, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
  });
});

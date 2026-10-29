import type { Row } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import type { DataTableFeatures } from "./data-table-features";
import { includesText } from "./filter-fns";

function rowWith(value: unknown) {
  return { getValue: () => value } as unknown as Row<DataTableFeatures, object>;
}

describe("includesText", () => {
  it("matches every row when the search is empty or only spaces", () => {
    expect(includesText(rowWith("Crecimiento"), "name", "")).toBe(true);
    expect(includesText(rowWith("Crecimiento"), "name", "   ")).toBe(true);
  });

  it("matches when the text contains the search, ignoring case", () => {
    expect(includesText(rowWith("Renta fija"), "name", "RENTA")).toBe(true);
    expect(includesText(rowWith("Renta fija"), "name", "ta f")).toBe(true);
  });

  it("ignores accents on both sides", () => {
    expect(includesText(rowWith("Educación"), "name", "educacion")).toBe(true);
    expect(includesText(rowWith("Educacion"), "name", "EDUCACIÓN")).toBe(true);
  });

  it("ignores the spaces around the search", () => {
    expect(includesText(rowWith("Renta fija"), "name", "  fija ")).toBe(true);
  });

  it("does not match when the text does not contain the search", () => {
    expect(includesText(rowWith("Crecimiento"), "name", "zzz")).toBe(false);
  });

  it("reads numbers as text", () => {
    expect(includesText(rowWith(1250), "value", "25")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { toDomainChanges, type SkippedChanges } from "./scenario-mapper.js";

function skippedBy(value: Parameters<typeof toDomainChanges>[0]): SkippedChanges[] {
  const skipped: SkippedChanges[] = [];
  toDomainChanges(value, (entry) => skipped.push(entry));
  return skipped;
}

describe("toDomainChanges skipped entries", () => {
  it("reports nothing for well-formed changes", () => {
    expect(skippedBy([{ assetId: "a1", percentChange: 4 }])).toEqual([]);
    expect(skippedBy([])).toEqual([]);
  });

  it("reports a column that is not an array, without an index", () => {
    expect(skippedBy({ assetId: "a1" })).toEqual([{ reason: "not_an_array" }]);
    expect(skippedBy(null)).toEqual([{ reason: "not_an_array" }]);
  });

  it("reports each entry that is not an object, with its position", () => {
    expect(skippedBy([5, { assetId: "a1", percentChange: 1 }, null, ["x"]])).toEqual([
      { reason: "not_an_object", index: 0 },
      { reason: "not_an_object", index: 2 },
      { reason: "not_an_object", index: 3 },
    ]);
  });

  it("reports each object without a string assetId and a finite percentChange", () => {
    expect(
      skippedBy([
        { assetId: "a1", percentChange: 4 },
        { assetId: "a2", percentChange: "4" },
        { percentChange: 9 },
        { assetId: 7, percentChange: 9 },
      ]),
    ).toEqual([
      { reason: "invalid_asset_or_percent", index: 1 },
      { reason: "invalid_asset_or_percent", index: 2 },
      { reason: "invalid_asset_or_percent", index: 3 },
    ]);
  });

  it("never passes the stored value to the callback", () => {
    const secret = "stored-value-that-must-not-leak";

    expect(
      JSON.stringify(skippedBy([{ assetId: secret, percentChange: secret }, secret])),
    ).not.toContain(secret);
  });

  it("returns the same changes with or without a callback", () => {
    const value = [{ assetId: "a1", percentChange: 4 }, 5, { assetId: "a2" }];

    expect(toDomainChanges(value, () => undefined)).toEqual(toDomainChanges(value));
    expect(toDomainChanges(value)).toEqual([{ assetId: "a1", percentChange: 4 }]);
  });
});

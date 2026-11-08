import { describe, expect, it } from "vitest";
import type { WatchlistItem } from "@trading/domain";
import { presentWatchlistItem, watchlistItemResponseSchema } from "./watchlist.response.js";

const entity: WatchlistItem = {
  id: "w1",
  userId: "u1",
  assetId: "a1",
  createdAt: new Date("2026-10-13T12:00:00.000Z"),
};

describe("watchlist presenter", () => {
  it("serializes exactly what the API returned before", () => {
    const dto = presentWatchlistItem(entity);
    expect(dto).toEqual(JSON.parse(JSON.stringify(entity)));
    expect(watchlistItemResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("does not leak fields outside the contract", () => {
    const dto = presentWatchlistItem({ ...entity, extra: 1 } as WatchlistItem);
    expect(Object.keys(dto).sort()).toEqual(["assetId", "createdAt", "id", "userId"]);
  });
});

import { API_OPERATIONS } from "@trading/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import type { TradingClient } from "@/api/trading-client";
import { createDemoTradingClient } from "../create-demo-trading-client";
import { createDemoComposition } from "../demo-composition";

const op = (id: string) => findOperation(API_OPERATIONS, id);

let client: TradingClient;
let assetId: string;

beforeEach(async () => {
  client = createDemoTradingClient({ composition: await createDemoComposition() });
  await client.call(op("login"), { body: { email: "demo@example.com", password: "x" } });
  const listed = (await client.call(op("listAssets"), { query: { search: "AAPL" } })) as {
    data: { id: string }[];
  };
  assetId = listed.data[0]?.id ?? "";
});

describe("watchlist handlers", () => {
  it("opens with the seeded assets, adds another one and lists it", async () => {
    interface Listed {
      data: { assetId: string }[];
    }
    const before = (await client.call(op("listWatchlist"))) as Listed;
    expect(before.data).toHaveLength(3);
    expect(before.data.map((item) => item.assetId)).not.toContain(assetId);

    await expect(client.call(op("addToWatchlist"), { body: { assetId } })).resolves.toMatchObject({
      data: { assetId },
    });

    const after = (await client.call(op("listWatchlist"))) as Listed;
    expect(after.data).toHaveLength(4);
    expect(after.data.map((item) => item.assetId)).toContain(assetId);
  });

  it("refuses to add the same asset twice with 400, as the API does, and an unknown asset", async () => {
    await client.call(op("addToWatchlist"), { body: { assetId } });

    await expect(client.call(op("addToWatchlist"), { body: { assetId } })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
    await expect(
      client.call(op("addToWatchlist"), { body: { assetId: "missing" } }),
    ).rejects.toMatchObject({ status: expect.any(Number) as unknown });
  });

  it("removes an asset with no content", async () => {
    await client.call(op("addToWatchlist"), { body: { assetId } });

    await expect(
      client.call(op("removeFromWatchlist"), { params: { assetId } }),
    ).resolves.toBeUndefined();
    const remaining = (await client.call(op("listWatchlist"))) as { data: { assetId: string }[] };
    expect(remaining.data.map((item) => item.assetId)).not.toContain(assetId);
  });
});

describe("preference handlers", () => {
  it("answers null before any change and keeps what was updated", async () => {
    await expect(client.call(op("getPreferences"))).resolves.toEqual({ data: null });

    await expect(
      client.call(op("updatePreferences"), { body: { theme: "dark", language: "es" } }),
    ).resolves.toMatchObject({ data: { theme: "dark", language: "es" } });
    await expect(client.call(op("getPreferences"))).resolves.toMatchObject({
      data: { theme: "dark", language: "es" },
    });
  });

  it("refuses an empty update and an unknown theme", async () => {
    await expect(client.call(op("updatePreferences"), { body: {} })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(
      client.call(op("updatePreferences"), { body: { theme: "neon" } }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });
});

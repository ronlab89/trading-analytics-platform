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
  it("starts empty, adds an asset and lists it", async () => {
    await expect(client.call(op("listWatchlist"))).resolves.toMatchObject({ data: [] });

    await expect(client.call(op("addToWatchlist"), { body: { assetId } })).resolves.toMatchObject({
      data: { assetId },
    });

    await expect(client.call(op("listWatchlist"))).resolves.toMatchObject({
      data: [{ assetId }],
    });
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
    await expect(client.call(op("listWatchlist"))).resolves.toMatchObject({ data: [] });
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

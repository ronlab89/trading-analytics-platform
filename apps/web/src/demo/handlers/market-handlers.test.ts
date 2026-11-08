import { fixedClock } from "@trading/application";
import { API_OPERATIONS } from "@trading/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import type { TradingClient } from "@/api/trading-client";
import { createDemoTradingClient } from "../create-demo-trading-client";
import { createDemoComposition } from "../demo-composition";

const op = (id: string) => findOperation(API_OPERATIONS, id);

interface Asset {
  id: string;
  symbol: string;
  assetType: string;
}

let client: TradingClient;

beforeEach(async () => {
  const clock = fixedClock(new Date("2026-01-31T12:00:00Z"));
  client = createDemoTradingClient({ composition: await createDemoComposition({ clock }) });
  await client.call(op("login"), { body: { email: "demo@example.com", password: "x" } });
});

async function assets(query: Record<string, string | number> = {}) {
  return (await client.call(op("listAssets"), { query })) as {
    data: Asset[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  };
}

describe("market handlers", () => {
  it("lists the seeded assets with the paging meta of the API", async () => {
    const { data, meta } = await assets({ page: 1, pageSize: 4 });

    expect(data).toHaveLength(4);
    expect(meta).toEqual({ page: 1, pageSize: 4, total: 6, totalPages: 2 });
  });

  it("filters the assets by type and by search text", async () => {
    expect((await assets({ assetType: "CRYPTO" })).data.map((a) => a.symbol)).toEqual([
      "BTC",
      "ETH",
    ]);
    expect((await assets({ search: "apple" })).data.map((a) => a.symbol)).toEqual(["AAPL"]);
  });

  it("refuses an unknown asset type as 400 VALIDATION_ERROR", async () => {
    await expect(assets({ assetType: "BOND" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("gets an asset and its price, and answers 404 for an unknown asset", async () => {
    const [aapl] = (await assets({ search: "AAPL" })).data;
    const params = { assetId: aapl?.id ?? "" };

    await expect(client.call(op("getAsset"), { params })).resolves.toMatchObject({
      data: { symbol: "AAPL" },
    });
    await expect(client.call(op("getAssetPrice"), { params })).resolves.toMatchObject({
      data: { assetId: aapl?.id, changePercent: 1.2 },
    });
    await expect(
      client.call(op("getAsset"), { params: { assetId: "missing" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("serves the daily history of the range and the batch of prices", async () => {
    const all = (await assets()).data;
    const first = all[0];

    const history = (await client.call(op("getAssetHistory"), {
      params: { assetId: first?.id ?? "" },
      query: { from: "2026-01-01", to: "2026-01-31" },
    })) as { data: unknown[] };
    const prices = (await client.call(op("getMarketPrices"), {
      query: { assetIds: all.map((asset) => asset.id).join(",") },
    })) as { data: unknown[] };

    expect(history.data).toHaveLength(30);
    expect(prices.data).toHaveLength(6);
  });

  it("refuses a history range that ends before it starts", async () => {
    await expect(
      client.call(op("getAssetHistory"), {
        params: { assetId: "x" },
        query: { from: "2026-02-01", to: "2026-01-01" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });
});

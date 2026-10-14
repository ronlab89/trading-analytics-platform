import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import {
  body,
  type DataEnvelope,
  type DataMetaEnvelope,
  type ErrorEnvelope,
} from "../test-utils/api-client.js";
import { tokenFor } from "../test-utils/auth.js";
import {
  cleanupTestData,
  createTestAsset,
  createTestHistoricalPrice,
  createTestMarketPrice,
  createTestUser,
} from "../test-utils/fixtures.js";

interface MoneyDto {
  amount: string;
  currency: string;
}

interface AssetDto {
  id: string;
  symbol: string;
  name: string;
  assetType: string;
  currency: string;
  exchange: string;
  status: string;
  metadata: Record<string, unknown>;
}

interface MarketPriceDto {
  assetId: string;
  price: MoneyDto;
  previousPrice: MoneyDto;
  change: MoneyDto;
  changePercent: number;
  timestamp: string;
  source: string;
}

interface HistoricalPriceDto {
  assetId: string;
  timestamp: string;
  open: MoneyDto;
  high: MoneyDto;
  low: MoneyDto;
  close: MoneyDto;
  volume: number;
}

interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type ListBody = DataMetaEnvelope<AssetDto[], PageMeta>;

/**
 * Characterization tests for the assets routes (B0.3 T3). They pin today's
 * HTTP behavior, including known quirks, so the layering refactor is provably
 * behavior-preserving. Do not "fix" an assertion here without recording it in
 * odd/tasks/b0-3-route-tests.md.
 *
 * The test DB also holds seeded/shared assets, so every list request is
 * scoped with a unique `search` (symbol prefix) before asserting totals.
 */
describe("assets routes", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];
  const unique = crypto.randomUUID().slice(0, 6).toUpperCase();

  // Listing fixtures (all symbols start with `AL${unique}`):
  //   stockA  STOCK  USD NYSE   ACTIVE    (name "Alpha Listing")
  //   stockB  STOCK  USD NASDAQ ACTIVE
  //   etfC    ETF    EUR NYSE   ACTIVE
  //   cryptoD CRYPTO USD BINANCE INACTIVE
  //   forexE  FOREX  GBP FXMKT  ACTIVE
  const listPrefix = `AL${unique}`;
  let token: string;
  let stockAId: string;
  let stockBId: string;
  let etfCId: string;
  let cryptoDId: string;
  let forexEId: string;

  // Price / history fixtures
  let pricedAssetId: string;
  let unpricedAssetId: string;
  let historyAssetId: string;
  let emptyHistoryAssetId: string;

  const auth = (): [string, string] => ["Authorization", `Bearer ${token}`];
  const listUrl = (query: string): string =>
    `/api/v1/assets?search=${listPrefix}${query === "" ? "" : `&${query}`}`;
  const historyUrl = (id: string, query: string): string => `/api/v1/assets/${id}/history?${query}`;

  async function newAsset(
    prefix: string,
    overrides: Parameters<typeof createTestAsset>[1] = {},
  ): Promise<string> {
    const handle = await createTestAsset(prefix, overrides);
    assetIds.push(handle.id);
    return handle.id;
  }

  beforeAll(async () => {
    const user = await createTestUser();
    userIds.push(user.user.id);
    token = tokenFor(user.user.id);

    stockAId = await newAsset(listPrefix, {
      name: "Alpha Listing",
      exchange: "NYSE",
    });
    stockBId = await newAsset(listPrefix, { exchange: "NASDAQ" });
    etfCId = await newAsset(listPrefix, { assetType: "ETF", currency: "EUR", exchange: "NYSE" });
    cryptoDId = await newAsset(listPrefix, {
      assetType: "CRYPTO",
      exchange: "BINANCE",
      status: "INACTIVE",
    });
    forexEId = await newAsset(listPrefix, {
      assetType: "FOREX",
      currency: "GBP",
      exchange: "FXMKT",
    });

    pricedAssetId = await newAsset(`AP${unique}`);
    await createTestMarketPrice(pricedAssetId, {
      price: 150.5,
      previousPrice: 100,
      timestamp: new Date("2026-06-01T12:00:00Z"),
    });
    unpricedAssetId = await newAsset(`AU${unique}`);

    historyAssetId = await newAsset(`AH${unique}`);
    // Inserted out of chronological order to prove the repository sorts asc.
    await createTestHistoricalPrice(historyAssetId, new Date("2026-03-03T00:00:00Z"), {
      close: 103,
    });
    await createTestHistoricalPrice(historyAssetId, new Date("2026-03-01T00:00:00Z"), {
      open: 99.5,
      high: 110.25,
      low: 90,
      close: 101,
      volume: 2500,
    });
    await createTestHistoricalPrice(historyAssetId, new Date("2026-03-02T00:00:00Z"), {
      close: 102,
    });
    emptyHistoryAssetId = await newAsset(`AE${unique}`);
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  describe("authentication", () => {
    const urls = (): Record<string, string> => ({
      list: "/api/v1/assets",
      detail: `/api/v1/assets/${stockAId}`,
      price: `/api/v1/assets/${pricedAssetId}/price`,
      history: historyUrl(historyAssetId, "from=2026-03-01&to=2026-03-31"),
    });

    it.each(["list", "detail", "price", "history"])(
      "rejects %s without a token with 401",
      async (name) => {
        const url = urls()[name] ?? "";
        const response = await request(app).get(url);

        expect(response.status).toBe(401);
        expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
      },
    );

    it.each(["list", "detail", "price", "history"])(
      "rejects %s with an invalid token with 401",
      async (name) => {
        const url = urls()[name] ?? "";
        const response = await request(app).get(url).set("Authorization", "Bearer not-a-token");

        expect(response.status).toBe(401);
        expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
      },
    );
  });

  describe("GET /api/v1/assets", () => {
    it("lists assets sorted by symbol with exact fields and pagination defaults", async () => {
      const response = await request(app)
        .get(listUrl(""))
        .set(...auth());

      expect(response.status).toBe(200);
      const result = body<ListBody>(response);
      expect(result.meta).toEqual({ page: 1, pageSize: 20, total: 5, totalPages: 1 });
      expect(result.data).toHaveLength(5);

      const symbols = result.data.map((a) => a.symbol);
      expect(symbols).toEqual([...symbols].sort());

      const alpha = result.data.find((a) => a.id === stockAId);
      expect(alpha).toEqual({
        id: stockAId,
        symbol: expect.stringMatching(new RegExp(`^${listPrefix}-`)) as string,
        name: "Alpha Listing",
        assetType: "STOCK",
        currency: "USD",
        exchange: "NYSE",
        status: "ACTIVE",
        metadata: {},
      });
      expect(Object.keys(alpha ?? {}).sort()).toEqual([
        "assetType",
        "currency",
        "exchange",
        "id",
        "metadata",
        "name",
        "status",
        "symbol",
      ]);
    });

    it("matches search against the name case-insensitively", async () => {
      const response = await request(app)
        .get("/api/v1/assets?search=alpha%20listing")
        .set(...auth());

      expect(response.status).toBe(200);
      const result = body<ListBody>(response);
      expect(result.data.map((a) => a.id)).toContain(stockAId);
      expect(result.data.every((a) => a.name.toLowerCase().includes("alpha listing"))).toBe(true);
    });

    it("matches search against the symbol case-insensitively", async () => {
      const response = await request(app)
        .get(`/api/v1/assets?search=${listPrefix.toLowerCase()}`)
        .set(...auth());

      expect(response.status).toBe(200);
      expect(body<ListBody>(response).meta.total).toBe(5);
    });

    it("returns an empty page when nothing matches", async () => {
      const response = await request(app)
        .get("/api/v1/assets?search=ZZNOSUCHASSET")
        .set(...auth());

      expect(response.status).toBe(200);
      expect(body<ListBody>(response)).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });
    });

    it.each([
      ["assetType=ETF", () => [etfCId]],
      ["assetType=CRYPTO", () => [cryptoDId]],
      ["assetType=FOREX", () => [forexEId]],
      ["exchange=NYSE", () => [stockAId, etfCId]],
      ["exchange=BINANCE", () => [cryptoDId]],
      ["currency=EUR", () => [etfCId]],
      ["currency=eur", () => [etfCId]],
      ["currency=GBP", () => [forexEId]],
      ["status=INACTIVE", () => [cryptoDId]],
      ["assetType=STOCK&exchange=NASDAQ", () => [stockBId]],
    ] as const)("filters by %s", async (query, expected) => {
      const response = await request(app)
        .get(listUrl(query))
        .set(...auth());

      expect(response.status).toBe(200);
      const result = body<ListBody>(response);
      expect(result.data.map((a) => a.id).sort()).toEqual([...expected()].sort());
      expect(result.meta.total).toBe(expected().length);
    });

    it("filters by status=ACTIVE", async () => {
      const response = await request(app)
        .get(listUrl("status=ACTIVE"))
        .set(...auth());

      expect(response.status).toBe(200);
      const result = body<ListBody>(response);
      expect(result.meta.total).toBe(4);
      expect(result.data.map((a) => a.id)).not.toContain(cryptoDId);
    });

    it("matches exchange exactly and case-sensitively", async () => {
      const response = await request(app)
        .get(listUrl("exchange=nyse"))
        .set(...auth());

      expect(response.status).toBe(200);
      expect(body<ListBody>(response).meta.total).toBe(0);
    });

    it("paginates with page, pageSize, total and totalPages", async () => {
      const first = await request(app)
        .get(listUrl("pageSize=2&page=1"))
        .set(...auth());
      const second = await request(app)
        .get(listUrl("pageSize=2&page=2"))
        .set(...auth());
      const third = await request(app)
        .get(listUrl("pageSize=2&page=3"))
        .set(...auth());
      const beyond = await request(app)
        .get(listUrl("pageSize=2&page=4"))
        .set(...auth());

      const pages = [first, second, third, beyond].map((r) => body<ListBody>(r));
      expect(pages.map((p) => p.meta)).toEqual([
        { page: 1, pageSize: 2, total: 5, totalPages: 3 },
        { page: 2, pageSize: 2, total: 5, totalPages: 3 },
        { page: 3, pageSize: 2, total: 5, totalPages: 3 },
        { page: 4, pageSize: 2, total: 5, totalPages: 3 },
      ]);
      expect(pages.map((p) => p.data.length)).toEqual([2, 2, 1, 0]);

      const ids = pages.flatMap((p) => p.data.map((a) => a.id));
      expect(new Set(ids).size).toBe(5);
    });

    it("trims whitespace around search", async () => {
      const response = await request(app)
        .get(`/api/v1/assets?search=%20${listPrefix}%20`)
        .set(...auth());

      expect(response.status).toBe(200);
      expect(body<ListBody>(response).meta.total).toBe(5);
    });

    it.each([
      ["a bad assetType", "assetType=BOND", "assetType"],
      ["a lowercase assetType", "assetType=stock", "assetType"],
      ["a bad status", "status=DELETED", "status"],
      ["pageSize above 100", "pageSize=101", "pageSize"],
      ["pageSize 0", "pageSize=0", "pageSize"],
      ["page 0", "page=0", "page"],
      ["a non-numeric page", "page=abc", "page"],
      ["an empty search", "search=", "search"],
      ["a whitespace-only search", "search=%20%20", "search"],
      ["a search longer than 100 chars", `search=${"a".repeat(101)}`, "search"],
      ["a 2-letter currency", "currency=US", "currency"],
      ["a 4-letter currency", "currency=USDX", "currency"],
    ])("returns 400 VALIDATION_ERROR for %s", async (_name, query, field) => {
      const response = await request(app)
        .get(`/api/v1/assets?${query}`)
        .set(...auth());

      expect(response.status).toBe(400);
      const error = body<ErrorEnvelope>(response).error;
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details?.map((d) => d.field)).toContain(field);
    });

    it("accepts pageSize of exactly 100", async () => {
      const response = await request(app)
        .get(listUrl("pageSize=100"))
        .set(...auth());

      expect(response.status).toBe(200);
      expect(body<ListBody>(response).meta.pageSize).toBe(100);
    });
  });

  describe("GET /api/v1/assets/:assetId", () => {
    it("returns the asset", async () => {
      const response = await request(app)
        .get(`/api/v1/assets/${stockAId}`)
        .set(...auth());

      expect(response.status).toBe(200);
      const asset = body<DataEnvelope<AssetDto>>(response).data;
      expect(asset).toEqual({
        id: stockAId,
        symbol: expect.stringMatching(new RegExp(`^${listPrefix}-`)) as string,
        name: "Alpha Listing",
        assetType: "STOCK",
        currency: "USD",
        exchange: "NYSE",
        status: "ACTIVE",
        metadata: {},
      });
    });

    it("returns inactive assets too", async () => {
      const response = await request(app)
        .get(`/api/v1/assets/${cryptoDId}`)
        .set(...auth());

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<AssetDto>>(response).data.status).toBe("INACTIVE");
    });

    it("returns 404 for an unknown asset", async () => {
      const response = await request(app)
        .get("/api/v1/assets/does-not-exist")
        .set(...auth());

      expect(response.status).toBe(404);
      const error = body<ErrorEnvelope>(response).error;
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("The requested asset could not be found.");
    });
  });

  describe("GET /api/v1/assets/:assetId/price", () => {
    it("returns the current price with Money serialized as {amount, currency}", async () => {
      const response = await request(app)
        .get(`/api/v1/assets/${pricedAssetId}/price`)
        .set(...auth());

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<MarketPriceDto>>(response).data).toEqual({
        assetId: pricedAssetId,
        price: { amount: "150.5", currency: "USD" },
        previousPrice: { amount: "100", currency: "USD" },
        change: { amount: "50.5", currency: "USD" },
        changePercent: 50.5,
        timestamp: "2026-06-01T12:00:00.000Z",
        source: expect.any(String) as string,
      });
    });

    it("returns 404 with the asset message when the asset does not exist", async () => {
      const response = await request(app)
        .get("/api/v1/assets/does-not-exist/price")
        .set(...auth());

      expect(response.status).toBe(404);
      const error = body<ErrorEnvelope>(response).error;
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("The requested asset could not be found.");
    });

    it("returns 404 with the price message when the asset has no current price", async () => {
      const response = await request(app)
        .get(`/api/v1/assets/${unpricedAssetId}/price`)
        .set(...auth());

      expect(response.status).toBe(404);
      const error = body<ErrorEnvelope>(response).error;
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("No current price is available for this asset.");
    });
  });

  describe("GET /api/v1/assets/:assetId/history", () => {
    it("returns candles in the range, ascending by timestamp, with exact fields", async () => {
      const response = await request(app)
        .get(historyUrl(historyAssetId, "from=2026-03-01&to=2026-03-31"))
        .set(...auth());

      expect(response.status).toBe(200);
      const data = body<DataEnvelope<HistoricalPriceDto[]>>(response).data;
      expect(data.map((c) => c.timestamp)).toEqual([
        "2026-03-01T00:00:00.000Z",
        "2026-03-02T00:00:00.000Z",
        "2026-03-03T00:00:00.000Z",
      ]);
      expect(data[0]).toEqual({
        assetId: historyAssetId,
        timestamp: "2026-03-01T00:00:00.000Z",
        open: { amount: "99.5", currency: "USD" },
        high: { amount: "110.25", currency: "USD" },
        low: { amount: "90", currency: "USD" },
        close: { amount: "101", currency: "USD" },
        volume: 2500,
      });
    });

    it("includes candles exactly on the from and to boundaries", async () => {
      const response = await request(app)
        .get(historyUrl(historyAssetId, "from=2026-03-02T00:00:00Z&to=2026-03-02T00:00:00Z"))
        .set(...auth());

      expect(response.status).toBe(200);
      expect(
        body<DataEnvelope<HistoricalPriceDto[]>>(response).data.map((c) => c.timestamp),
      ).toEqual(["2026-03-02T00:00:00.000Z"]);
    });

    it("filters to a narrower range", async () => {
      const response = await request(app)
        .get(historyUrl(historyAssetId, "from=2026-03-02&to=2026-03-03&interval=1d"))
        .set(...auth());

      expect(response.status).toBe(200);
      expect(
        body<DataEnvelope<HistoricalPriceDto[]>>(response).data.map((c) => c.timestamp),
      ).toEqual(["2026-03-02T00:00:00.000Z", "2026-03-03T00:00:00.000Z"]);
    });

    it("returns [] for a range with no candles", async () => {
      const response = await request(app)
        .get(historyUrl(historyAssetId, "from=2025-01-01&to=2025-12-31"))
        .set(...auth());

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<HistoricalPriceDto[]>>(response)).toEqual({ data: [] });
    });

    it("returns [] for an asset with no history", async () => {
      const response = await request(app)
        .get(historyUrl(emptyHistoryAssetId, "from=2026-01-01&to=2026-12-31"))
        .set(...auth());

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<HistoricalPriceDto[]>>(response)).toEqual({ data: [] });
    });

    it("returns 404 for an unknown asset", async () => {
      const response = await request(app)
        .get(historyUrl("does-not-exist", "from=2026-03-01&to=2026-03-31"))
        .set(...auth());

      expect(response.status).toBe(404);
      const error = body<ErrorEnvelope>(response).error;
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("The requested asset could not be found.");
    });

    it.each([
      ["missing from and to", "", ["from", "to"]],
      ["missing to", "from=2026-03-01", ["to"]],
      ["missing from", "to=2026-03-31", ["from"]],
      ["an invalid from date", "from=not-a-date&to=2026-03-31", ["from"]],
      ["an invalid to date", "from=2026-03-01&to=nope", ["to"]],
      ["an unsupported interval", "from=2026-03-01&to=2026-03-31&interval=1h", ["interval"]],
    ])("returns 400 VALIDATION_ERROR for %s", async (_name, query, fields) => {
      const response = await request(app)
        .get(historyUrl(historyAssetId, query))
        .set(...auth());

      expect(response.status).toBe(400);
      const error = body<ErrorEnvelope>(response).error;
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details?.map((d) => d.field)).toEqual(expect.arrayContaining(fields));
    });

    it("returns 400 on field `from` when from is after to", async () => {
      const response = await request(app)
        .get(historyUrl(historyAssetId, "from=2026-04-01&to=2026-03-01"))
        .set(...auth());

      expect(response.status).toBe(400);
      const error = body<ErrorEnvelope>(response).error;
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        {
          field: "from",
          code: "custom",
          message: "'from' must not be after 'to'.",
        },
      ]);
    });

    it("validates the query before checking the asset exists", async () => {
      const response = await request(app)
        .get(historyUrl("does-not-exist", "from=2026-04-01&to=2026-03-01"))
        .set(...auth());

      expect(response.status).toBe(400);
      expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
    });
  });
});

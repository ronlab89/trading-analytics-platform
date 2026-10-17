import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { body, type DataEnvelope, type ErrorEnvelope } from "../test-utils/api-client.js";
import { tokenFor } from "../test-utils/auth.js";
import {
  cleanupTestData,
  createTestAsset,
  createTestMarketPrice,
  createTestUser,
} from "../test-utils/fixtures.js";

interface MoneyDto {
  amount: string;
  currency: string;
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

type PricesBody = DataEnvelope<MarketPriceDto[]>;

/**
 * Characterization tests for GET /api/v1/market/prices (B0.3 T4). They pin
 * today's HTTP behavior, including known quirks, so the layering refactor is
 * provably behavior-preserving. Do not "fix" an assertion here without
 * recording it in odd/tasks/b0/b0-3-route-tests.md.
 *
 * The repository query is `findMany({ where: { assetId: { in } } })` with no
 * orderBy, so ordering is not guaranteed: tests match items by assetId.
 */
describe("market routes", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];
  const unique = crypto.randomUUID().slice(0, 6).toUpperCase();

  let token: string;
  let assetAId: string;
  let assetBId: string;
  let assetCId: string;
  let unpricedId: string;

  const auth = (): [string, string] => ["Authorization", `Bearer ${token}`];
  const url = (ids: string): string => `/api/v1/market/prices?assetIds=${ids}`;
  const get = (ids: string): request.Test =>
    request(app)
      .get(url(ids))
      .set(...auth());
  const find = (items: MarketPriceDto[], id: string): MarketPriceDto | undefined =>
    items.find((item) => item.assetId === id);

  async function newAsset(prefix: string): Promise<string> {
    const handle = await createTestAsset(prefix);
    assetIds.push(handle.id);
    return handle.id;
  }

  beforeAll(async () => {
    const user = await createTestUser();
    userIds.push(user.user.id);
    token = tokenFor(user.user.id);

    assetAId = await newAsset(`MA${unique}`);
    await createTestMarketPrice(assetAId, {
      price: 150.5,
      previousPrice: 100,
      timestamp: new Date("2026-06-01T12:00:00Z"),
    });
    assetBId = await newAsset(`MB${unique}`);
    await createTestMarketPrice(assetBId, {
      price: 80,
      previousPrice: 100,
      timestamp: new Date("2026-06-02T12:00:00Z"),
    });
    assetCId = await newAsset(`MC${unique}`);
    await createTestMarketPrice(assetCId);
    unpricedId = await newAsset(`MU${unique}`);
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  describe("authentication", () => {
    it("rejects a request without a token with 401", async () => {
      const response = await request(app).get(url(assetAId));

      expect(response.status).toBe(401);
      expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
    });

    it("rejects a request with an invalid token with 401", async () => {
      const response = await request(app)
        .get(url(assetAId))
        .set("Authorization", "Bearer not-a-token");

      expect(response.status).toBe(401);
      expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
    });

    it("authenticates before validating the query", async () => {
      const response = await request(app).get("/api/v1/market/prices");

      expect(response.status).toBe(401);
    });
  });

  describe("validation", () => {
    it("returns 400 VALIDATION_ERROR when assetIds is missing", async () => {
      const response = await request(app)
        .get("/api/v1/market/prices")
        .set(...auth());

      expect(response.status).toBe(400);
      const error = body<ErrorEnvelope>(response).error;
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.requestId).toEqual(expect.any(String) as string);
      expect(error.details?.[0]?.field).toBe("assetIds");
    });

    it.each([
      ["an empty string", ""],
      ["a single comma", ","],
      ["only commas", ",,,"],
      ["only whitespace", "%20%20"],
      ["whitespace and commas", "%20,%20,"],
    ])("returns 400 VALIDATION_ERROR when assetIds is %s", async (_label, value) => {
      const response = await get(value);

      expect(response.status).toBe(400);
      const error = body<ErrorEnvelope>(response).error;
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details?.[0]?.field).toBe("assetIds");
    });

    it("returns 400 for 51 ids", async () => {
      const ids = Array.from({ length: 51 }, (_v, i) => `id-${String(i)}`).join(",");
      const response = await get(ids);

      expect(response.status).toBe(400);
      const error = body<ErrorEnvelope>(response).error;
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details?.[0]?.field).toBe("assetIds");
    });

    it("returns 200 for exactly 50 ids", async () => {
      const ids = [
        assetAId,
        ...Array.from({ length: 49 }, (_v, i) => `unknown-${unique}-${String(i)}`),
      ].join(",");
      const response = await get(ids);

      expect(response.status).toBe(200);
      const data = body<PricesBody>(response).data;
      expect(data).toHaveLength(1);
      expect(data[0]?.assetId).toBe(assetAId);
    });

    it("counts only non-empty ids toward the limit (50 ids plus empties is 200)", async () => {
      const ids = Array.from({ length: 50 }, (_v, i) => `unknown-${unique}-${String(i)}`);
      const response = await get(`,${ids.join(",,")},`);

      expect(response.status).toBe(200);
      expect(body<PricesBody>(response).data).toEqual([]);
    });
  });

  describe("GET /api/v1/market/prices", () => {
    it("returns exact fields with Money serialized as {amount, currency}", async () => {
      const response = await get(assetAId);

      expect(response.status).toBe(200);
      expect(body<PricesBody>(response)).toEqual({
        data: [
          {
            assetId: assetAId,
            price: { amount: "150.5", currency: "USD" },
            previousPrice: { amount: "100", currency: "USD" },
            change: { amount: "50.5", currency: "USD" },
            changePercent: 50.5,
            timestamp: "2026-06-01T12:00:00.000Z",
            source: expect.any(String) as string,
          },
        ],
      });
    });

    it("returns several assets, matched by assetId (no ordering guarantee)", async () => {
      const response = await get(`${assetAId},${assetBId},${assetCId}`);

      expect(response.status).toBe(200);
      const data = body<PricesBody>(response).data;
      expect(data).toHaveLength(3);
      expect(find(data, assetAId)?.price).toEqual({ amount: "150.5", currency: "USD" });
      expect(find(data, assetBId)).toMatchObject({
        price: { amount: "80", currency: "USD" },
        previousPrice: { amount: "100", currency: "USD" },
        change: { amount: "-20", currency: "USD" },
        changePercent: -20,
        timestamp: "2026-06-02T12:00:00.000Z",
      });
      expect(find(data, assetCId)).toMatchObject({
        price: { amount: "100", currency: "USD" },
        change: { amount: "0", currency: "USD" },
        changePercent: 0,
      });
    });

    it("tolerates whitespace around ids and a trailing comma", async () => {
      const response = await get(`%20${assetAId}%20,%20${assetBId}%20,`);

      expect(response.status).toBe(200);
      const data = body<PricesBody>(response).data;
      expect(data.map((item) => item.assetId).sort()).toEqual([assetAId, assetBId].sort());
    });

    it("ignores empty segments between ids", async () => {
      const response = await get(`,${assetAId},,${assetBId},`);

      expect(response.status).toBe(200);
      expect(body<PricesBody>(response).data).toHaveLength(2);
    });

    it("omits unknown ids and returns the known ones with 200 (never 404)", async () => {
      const response = await get(`${assetAId},unknown-${unique},${assetBId}`);

      expect(response.status).toBe(200);
      const data = body<PricesBody>(response).data;
      expect(data.map((item) => item.assetId).sort()).toEqual([assetAId, assetBId].sort());
    });

    it("returns data: [] when every id is unknown", async () => {
      const response = await get(`unknown-${unique}-1,unknown-${unique}-2`);

      expect(response.status).toBe(200);
      expect(body<PricesBody>(response)).toEqual({ data: [] });
    });

    it("does not deduplicate ids in validation but returns one row per asset", async () => {
      const response = await get(`${assetAId},${assetAId},${assetAId}`);

      expect(response.status).toBe(200);
      const data = body<PricesBody>(response).data;
      expect(data).toHaveLength(1);
      expect(data[0]?.assetId).toBe(assetAId);
    });

    it("counts duplicate ids toward the 50-id limit", async () => {
      const response = await get(Array.from({ length: 51 }, () => assetAId).join(","));

      expect(response.status).toBe(400);
      expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
    });

    it("omits an existing asset that has no market price (never 404)", async () => {
      const response = await get(unpricedId);

      expect(response.status).toBe(200);
      expect(body<PricesBody>(response)).toEqual({ data: [] });
    });

    it("returns only the priced assets when mixed with an unpriced one", async () => {
      const response = await get(`${unpricedId},${assetAId}`);

      expect(response.status).toBe(200);
      const data = body<PricesBody>(response).data;
      expect(data).toHaveLength(1);
      expect(data[0]?.assetId).toBe(assetAId);
    });
  });
});

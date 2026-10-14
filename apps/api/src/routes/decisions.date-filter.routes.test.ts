import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { body, type DataEnvelope } from "../test-utils/api-client.js";
import { tokenFor } from "../test-utils/auth.js";
import {
  cleanupTestData,
  createTestAsset,
  createTestDecision,
  createTestPortfolio,
  createTestUser,
} from "../test-utils/fixtures.js";

/**
 * B0.4 T5: `dateFrom` and `dateTo` on GET /portfolios/:id/decisions filter
 * on `createdAt`, both bounds inclusive.
 */
describe("decisions date filter", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let token: string;
  let portfolioId: string;
  const ids: Record<"day1" | "day2" | "day3", string> = { day1: "", day2: "", day3: "" };

  const list = async (query: Record<string, string>): Promise<string[]> => {
    const response = await request(app)
      .get(`/api/v1/portfolios/${portfolioId}/decisions`)
      .query(query)
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    return body<DataEnvelope<{ id: string }[]>>(response)
      .data.map((d) => d.id)
      .sort();
  };

  beforeAll(async () => {
    const { user } = await createTestUser();
    userIds.push(user.id);
    token = tokenFor(user.id);
    portfolioId = (await createTestPortfolio(user.id)).id;
    const asset = await createTestAsset("DTF");
    assetIds.push(asset.id);

    ids.day1 = (
      await createTestDecision(portfolioId, asset.id, {
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
      })
    ).id;
    ids.day2 = (
      await createTestDecision(portfolioId, asset.id, {
        createdAt: new Date("2026-03-02T12:00:00.000Z"),
      })
    ).id;
    ids.day3 = (
      await createTestDecision(portfolioId, asset.id, {
        createdAt: new Date("2026-03-03T12:00:00.000Z"),
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  it("dateFrom keeps decisions created at or after it (inclusive)", async () => {
    expect(await list({ dateFrom: "2026-03-02T12:00:00.000Z" })).toEqual(
      [ids.day2, ids.day3].sort(),
    );
  });

  it("dateTo keeps decisions created at or before it (inclusive)", async () => {
    expect(await list({ dateTo: "2026-03-02T12:00:00.000Z" })).toEqual([ids.day1, ids.day2].sort());
  });

  it("combines both bounds", async () => {
    expect(
      await list({ dateFrom: "2026-03-02T00:00:00.000Z", dateTo: "2026-03-02T23:59:59.999Z" }),
    ).toEqual([ids.day2]);
  });
});

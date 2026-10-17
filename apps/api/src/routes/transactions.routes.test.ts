import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import {
  body,
  type DataEnvelope,
  type DataMetaEnvelope,
  type ErrorEnvelope,
} from "../test-utils/api-client.js";
import {
  cleanupTestData,
  createTestAsset,
  createTestPortfolio,
  createTestUser,
} from "../test-utils/fixtures.js";

interface PositionDto {
  quantity: number;
  averageEntryPrice: { amount: string; currency: string };
}

interface TransactionDto {
  id: string;
  status: string;
  quantity: number;
}

interface CreateTransactionResultDto {
  transaction: TransactionDto;
  position: PositionDto | null;
}

function tokenFor(userId: string): string {
  return jwt.sign({ sub: userId, role: "USER" }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN_SECONDS,
  });
}

/**
 * Integration tests for transaction creation and its effect on
 * positions. Source: FR-017 (Create Transaction), FR-074/NFR-015
 * (atomicity — see PrismaUnitOfWork).
 */
describe("transactions", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let userId: string;
  let token: string;
  let portfolioId: string;
  let assetId: string;

  beforeAll(async () => {
    const { user } = await createTestUser();
    userIds.push(user.id);
    userId = user.id;
    token = tokenFor(user.id);

    const portfolio = await createTestPortfolio(userId);
    portfolioId = portfolio.id;

    const asset = await createTestAsset();
    assetIds.push(asset.id);
    assetId = asset.id;
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  it("creates a BUY transaction and opens a new position", async () => {
    const response = await request(app)
      .post(`/api/v1/portfolios/${portfolioId}/transactions`)
      .set("Authorization", `Bearer ${token}`)
      .send({ assetId, type: "BUY", quantity: 10, price: { amount: "100", currency: "USD" } });

    expect(response.status).toBe(201);
    const { data } = body<DataEnvelope<CreateTransactionResultDto>>(response);
    expect(data.transaction.status).toBe("COMPLETED");
    expect(data.position).not.toBeNull();
    expect(data.position?.quantity).toBe(10);
  });

  it("rejects a malformed body (non-positive quantity) with 400 before touching persistence", async () => {
    const response = await request(app)
      .post(`/api/v1/portfolios/${portfolioId}/transactions`)
      .set("Authorization", `Bearer ${token}`)
      .send({ assetId, type: "BUY", quantity: -5, price: { amount: "100", currency: "USD" } });

    expect(response.status).toBe(400);
    expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a SELL whose fees exceed its gross proceeds with 400 and writes nothing", async () => {
    const localAsset = await createTestAsset("FEECAP");
    assetIds.push(localAsset.id);

    await request(app)
      .post(`/api/v1/portfolios/${portfolioId}/transactions`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        assetId: localAsset.id,
        type: "BUY",
        quantity: 10,
        price: { amount: "100", currency: "USD" },
      });

    const sell = await request(app)
      .post(`/api/v1/portfolios/${portfolioId}/transactions`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        assetId: localAsset.id,
        type: "SELL",
        quantity: 2,
        price: { amount: "100", currency: "USD" },
        fees: { amount: "200.01", currency: "USD" },
      });

    expect(sell.status).toBe(400);
    expect(body<ErrorEnvelope>(sell).error.code).toBe("VALIDATION_ERROR");

    const list = await request(app)
      .get(`/api/v1/portfolios/${portfolioId}/transactions`)
      .query({ assetId: localAsset.id, pageSize: 50 })
      .set("Authorization", `Bearer ${token}`);
    expect(body<DataMetaEnvelope<TransactionDto[]>>(list).data).toHaveLength(1);

    const equal = await request(app)
      .post(`/api/v1/portfolios/${portfolioId}/transactions`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        assetId: localAsset.id,
        type: "SELL",
        quantity: 2,
        price: { amount: "100", currency: "USD" },
        fees: { amount: "200", currency: "USD" },
      });
    expect(equal.status).toBe(201);
  });

  it(
    "rolls back the whole operation when a SELL exceeds the held quantity, " +
      "leaving no orphaned transaction behind (Unit of Work)",
    async () => {
      // Fresh asset/position for this test: sell more than is held.
      const localAsset = await createTestAsset("ROLLBACK");
      assetIds.push(localAsset.id);

      await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          assetId: localAsset.id,
          type: "BUY",
          quantity: 5,
          price: { amount: "50", currency: "USD" },
        });

      const oversell = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          assetId: localAsset.id,
          type: "SELL",
          quantity: 999,
          price: { amount: "50", currency: "USD" },
        });

      expect(oversell.status).toBe(400);
      expect(body<ErrorEnvelope>(oversell).error.code).toBe("VALIDATION_ERROR");

      // The failed SELL must not have persisted as a DRAFT transaction:
      // exactly one COMPLETED transaction (the earlier BUY) should exist.
      const list = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions`)
        .query({ assetId: localAsset.id, pageSize: 50 })
        .set("Authorization", `Bearer ${token}`);

      const { data: transactions } = body<DataMetaEnvelope<TransactionDto[]>>(list);
      expect(transactions).toHaveLength(1);
      expect(transactions[0]?.status).toBe("COMPLETED");

      // And the position must be untouched by the failed attempt.
      const overviewResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/overview`)
        .set("Authorization", `Bearer ${token}`);
      interface OverviewDto {
        positions: { position: { assetId: string; quantity: number } }[];
      }
      const overview = body<DataEnvelope<OverviewDto>>(overviewResponse).data;
      const position = overview.positions.find((p) => p.position.assetId === localAsset.id);
      expect(position?.position.quantity).toBe(5);
    },
  );

  it("lets exactly one of two concurrent SELLs of 6 on a holding of 10 succeed (FR-017 race)", async () => {
    const raceAsset = await createTestAsset("RACE");
    assetIds.push(raceAsset.id);
    const send = (type: "BUY" | "SELL", quantity: number) =>
      request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ assetId: raceAsset.id, type, quantity, price: { amount: "50", currency: "USD" } });

    expect((await send("BUY", 10)).status).toBe(201);

    const [first, second] = await Promise.all([send("SELL", 6), send("SELL", 6)]);

    expect([first.status, second.status].sort()).toEqual([201, 400]);
    const loser = first.status === 400 ? first : second;
    expect(body<ErrorEnvelope>(loser).error.code).toBe("VALIDATION_ERROR");

    // The BUY and exactly one SELL are persisted, both COMPLETED.
    const list = await request(app)
      .get(`/api/v1/portfolios/${portfolioId}/transactions`)
      .query({ assetId: raceAsset.id, pageSize: 50 })
      .set("Authorization", `Bearer ${token}`);
    const { data: transactions } = body<DataMetaEnvelope<TransactionDto[]>>(list);
    expect(transactions).toHaveLength(2);
    expect(transactions.every((t) => t.status === "COMPLETED")).toBe(true);

    // 10 - 6 = 4 held, never -2.
    const overviewResponse = await request(app)
      .get(`/api/v1/portfolios/${portfolioId}/overview`)
      .set("Authorization", `Bearer ${token}`);
    interface OverviewDto {
      positions: { position: { assetId: string; quantity: number } }[];
    }
    const overview = body<DataEnvelope<OverviewDto>>(overviewResponse).data;
    const position = overview.positions.find((p) => p.position.assetId === raceAsset.id);
    expect(position?.position.quantity).toBe(4);
  });

  it("rejects a transaction on an archived portfolio with 409 CONFLICT and writes nothing", async () => {
    const archived = await createTestPortfolio(userId);
    const buy = {
      assetId,
      type: "BUY",
      quantity: 3,
      price: { amount: "10", currency: "USD" },
    };
    const url = `/api/v1/portfolios/${archived.id}/transactions`;

    expect(
      (await request(app).post(url).set("Authorization", `Bearer ${token}`).send(buy)).status,
    ).toBe(201);
    expect(
      (
        await request(app)
          .post(`/api/v1/portfolios/${archived.id}/archive`)
          .set("Authorization", `Bearer ${token}`)
      ).status,
    ).toBe(200);

    const response = await request(app).post(url).set("Authorization", `Bearer ${token}`).send(buy);

    expect(response.status).toBe(409);
    expect(body<ErrorEnvelope>(response).error.code).toBe("CONFLICT");

    const list = await request(app)
      .get(url)
      .query({ pageSize: 50 })
      .set("Authorization", `Bearer ${token}`);
    expect(body<DataMetaEnvelope<TransactionDto[]>>(list).data).toHaveLength(1);
  });

  it("returns 404 when the referenced asset does not exist", async () => {
    const response = await request(app)
      .post(`/api/v1/portfolios/${portfolioId}/transactions`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        assetId: "00000000-0000-0000-0000-000000000000",
        type: "BUY",
        quantity: 1,
        price: { amount: "10", currency: "USD" },
      });

    expect(response.status).toBe(404);
  });
});

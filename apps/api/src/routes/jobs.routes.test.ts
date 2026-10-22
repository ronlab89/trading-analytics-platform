import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { body, type DataEnvelope, type ErrorEnvelope } from "../test-utils/api-client.js";
import {
  cleanupTestData,
  createTestAsset,
  createTestPortfolio,
  createTestUser,
} from "../test-utils/fixtures.js";

interface JobDto {
  id: string;
  portfolioId: string;
  status: string;
  attempt: number;
}

function tokenFor(userId: string): string {
  return jwt.sign({ sub: userId, role: "TRADER" }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN_SECONDS,
  });
}

/**
 * Integration tests for the import and job endpoints and for the
 * `Idempotency-Key` header. Source: ADR-008 points 2-9.
 *
 * The job runner is started only by `index.ts`, so a created job stays
 * `QUEUED` here and the cancel and retry rules can be checked on it.
 */
describe("jobs and idempotency", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let token: string;
  let otherToken: string;
  let portfolioId: string;
  let otherPortfolioId: string;
  let assetId: string;

  const csv = "symbol,type,quantity,price,executedAt\nAAA,BUY,1,100,2026-01-02T00:00:00Z";

  const buy = () => ({
    assetId,
    type: "BUY",
    quantity: 1,
    price: { amount: "100", currency: "USD" },
  });

  beforeAll(async () => {
    const { user } = await createTestUser();
    const { user: other } = await createTestUser();
    userIds.push(user.id, other.id);
    token = tokenFor(user.id);
    otherToken = tokenFor(other.id);

    portfolioId = (await createTestPortfolio(user.id)).id;
    otherPortfolioId = (await createTestPortfolio(user.id)).id;

    assetId = (await createTestAsset()).id;
    assetIds.push(assetId);
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  function importCsv(id: string, key?: string, text = csv) {
    const req = request(app)
      .post(`/api/v1/portfolios/${id}/imports`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "text/csv");

    return (key ? req.set("Idempotency-Key", key) : req).send(text);
  }

  describe("import creation", () => {
    it("queues the CSV and answers 202 with the job and its location", async () => {
      const response = await importCsv(portfolioId);

      expect(response.status).toBe(202);
      const job = body<DataEnvelope<JobDto>>(response).data;
      expect(job).toMatchObject({ portfolioId, status: "QUEUED", attempt: 1 });
      expect(job).not.toHaveProperty("input");
      expect(response.headers.location).toBe(`/api/v1/jobs/${job.id}`);
    });

    it("answers 400 for a body that is not a CSV file", async () => {
      const response = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/imports`)
        .set("Authorization", `Bearer ${token}`)
        .send({ csv });

      expect(response.status).toBe(400);
      expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
    });

    it("answers 413 for a file over 1 MB", async () => {
      const response = await importCsv(portfolioId, undefined, "x".repeat(1024 * 1024 + 1));

      expect(response.status).toBe(413);
    });

    it("answers 404 for a portfolio that is not the caller's", async () => {
      const response = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/imports`)
        .set("Authorization", `Bearer ${otherToken}`)
        .set("Content-Type", "text/csv")
        .send(csv);

      expect(response.status).toBe(404);
    });

    it("requires a token", async () => {
      const response = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/imports`)
        .set("Content-Type", "text/csv")
        .send(csv);

      expect(response.status).toBe(401);
    });
  });

  describe("job read, cancel and retry", () => {
    it("reads the owner's job and hides it from another user", async () => {
      const id = body<DataEnvelope<JobDto>>(await importCsv(portfolioId)).data.id;

      const read = await request(app)
        .get(`/api/v1/jobs/${id}`)
        .set("Authorization", `Bearer ${token}`);
      const hidden = await request(app)
        .get(`/api/v1/jobs/${id}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(read.status).toBe(200);
      expect(body<DataEnvelope<JobDto>>(read).data.id).toBe(id);
      expect(hidden.status).toBe(404);
    });

    it("cancels a queued job, then refuses to cancel or retry-in-place what the state does not allow", async () => {
      const id = body<DataEnvelope<JobDto>>(await importCsv(portfolioId)).data.id;
      const auth = { Authorization: `Bearer ${token}` };

      const retryQueued = await request(app).post(`/api/v1/jobs/${id}/retry`).set(auth);
      const cancel = await request(app).post(`/api/v1/jobs/${id}/cancel`).set(auth);
      const cancelAgain = await request(app).post(`/api/v1/jobs/${id}/cancel`).set(auth);
      const retry = await request(app).post(`/api/v1/jobs/${id}/retry`).set(auth);

      expect(retryQueued.status).toBe(409);
      expect(cancel.status).toBe(200);
      expect(body<DataEnvelope<JobDto>>(cancel).data.status).toBe("CANCELLED");
      expect(cancelAgain.status).toBe(409);
      expect(body<ErrorEnvelope>(cancelAgain).error.code).toBe("CONFLICT");
      expect(retry.status).toBe(202);
      expect(body<DataEnvelope<JobDto>>(retry).data).toMatchObject({
        status: "QUEUED",
        attempt: 2,
      });
    });
  });

  describe("Idempotency-Key", () => {
    it("answers a repeated import with the same job instead of queueing another", async () => {
      const first = await importCsv(portfolioId, "import-key-1");
      const second = await importCsv(portfolioId, "import-key-1");

      expect(first.status).toBe(202);
      expect(second.status).toBe(202);
      expect(second.headers["idempotency-replayed"]).toBe("true");
      expect(body<DataEnvelope<JobDto>>(second).data.id).toBe(
        body<DataEnvelope<JobDto>>(first).data.id,
      );
    });

    it("answers 409 for the same key with a different file or another portfolio", async () => {
      await importCsv(portfolioId, "import-key-2");

      const otherFile = await importCsv(portfolioId, "import-key-2", `${csv}\n`);
      const otherPortfolio = await importCsv(otherPortfolioId, "import-key-2");

      expect(otherFile.status).toBe(409);
      expect(body<ErrorEnvelope>(otherFile).error.code).toBe("CONFLICT");
      expect(otherPortfolio.status).toBe(409);
    });

    it("creates one transaction for a repeated request and replays the 201", async () => {
      const send = () =>
        request(app)
          .post(`/api/v1/portfolios/${portfolioId}/transactions`)
          .set("Authorization", `Bearer ${token}`)
          .set("Idempotency-Key", "tx-key-1")
          .send(buy());

      const first = await send();
      const second = await send();

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.headers["idempotency-replayed"]).toBe("true");
      expect(second.body).toEqual(first.body);

      const list = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set("Authorization", `Bearer ${token}`);
      const created = (list.body as { data: { id: string }[] }).data.filter(
        (t) =>
          t.id === (first.body as { data: { transaction: { id: string } } }).data.transaction.id,
      );
      expect(created).toHaveLength(1);
    });

    it("answers 409 for the same key with a different transaction", async () => {
      const send = (quantity: number) =>
        request(app)
          .post(`/api/v1/portfolios/${portfolioId}/transactions`)
          .set("Authorization", `Bearer ${token}`)
          .set("Idempotency-Key", "tx-key-2")
          .send({ ...buy(), quantity });

      await send(1);
      const different = await send(2);

      expect(different.status).toBe(409);
      expect(body<ErrorEnvelope>(different).error.code).toBe("CONFLICT");
    });

    it("lets two users use the same key independently", async () => {
      const send = (bearer: string, id: string) =>
        request(app)
          .post(`/api/v1/portfolios/${id}/imports`)
          .set("Authorization", `Bearer ${bearer}`)
          .set("Content-Type", "text/csv")
          .set("Idempotency-Key", "shared-key")
          .send(csv);

      const mine = await send(token, portfolioId);
      const theirs = await send(otherToken, portfolioId);

      expect(mine.status).toBe(202);
      // Their portfolio check fails (404), proving the key did not collide with mine (no 409).
      expect(theirs.status).toBe(404);
    });

    it("answers 400 for an invalid key and creates nothing", async () => {
      const response = await importCsv(portfolioId, "has space");

      expect(response.status).toBe(400);
      expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
    });

    it("keeps a request without a key working as before", async () => {
      const response = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set("Authorization", `Bearer ${token}`)
        .send(buy());

      expect(response.status).toBe(201);
      expect(response.headers["idempotency-replayed"]).toBeUndefined();
    });
  });
});

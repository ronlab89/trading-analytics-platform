import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "@trading/database";
import { createApp } from "../app.js";
import { tokenFor } from "../test-utils/auth.js";
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
  createTestPosition,
  createTestScenario,
  createTestUser,
} from "../test-utils/fixtures.js";

interface ScenarioDto {
  id: string;
  portfolioId: string;
  name: string;
  description: string | null;
  status: string;
  changes: { assetId: string; percentChange: number }[];
}

interface CalculationDto {
  difference: { totalValue: { amount: string; currency: string } };
}

const NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000";
const UNKNOWN_ASSET_ID = "00000000-0000-0000-0000-0000000000aa";

/**
 * Integration tests for the Scenarios write API.
 * Source: FR-036 (Create), FR-037 (Modify variables), FR-039 (Reset),
 * FR-040 (Save), FR-043 (Delete), 07-api-spec.md §25.
 *
 * Every test that mutates a scenario creates its own through the
 * fixture, so tests do not depend on each other.
 */
describe("scenarios write API", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let token: string;
  let otherUserToken: string;
  let portfolioId: string;
  let otherPortfolioId: string;
  let assetAId: string;
  let assetBId: string;

  beforeAll(async () => {
    const { user } = await createTestUser();
    const { user: otherUser } = await createTestUser();
    userIds.push(user.id, otherUser.id);
    token = tokenFor(user.id);
    otherUserToken = tokenFor(otherUser.id);

    portfolioId = (await createTestPortfolio(user.id)).id;
    otherPortfolioId = (await createTestPortfolio(user.id, { name: "Other portfolio" })).id;

    assetAId = (await createTestAsset("WRA")).id;
    assetBId = (await createTestAsset("WRB")).id;
    assetIds.push(assetAId, assetBId);

    await createTestPosition(portfolioId, assetAId, {
      quantity: 10,
      averageEntryPrice: 100,
      currentPrice: 100,
    });
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  function scenariosUrl(forPortfolioId = portfolioId): string {
    return `/api/v1/portfolios/${forPortfolioId}/scenarios`;
  }

  function scenarioUrl(scenarioId: string, forPortfolioId = portfolioId): string {
    return `${scenariosUrl(forPortfolioId)}/${scenarioId}`;
  }

  async function fetchScenario(scenarioId: string): Promise<ScenarioDto> {
    const response = await request(app)
      .get(scenarioUrl(scenarioId))
      .set("Authorization", `Bearer ${token}`);
    return body<DataEnvelope<ScenarioDto>>(response).data;
  }

  describe("POST /api/v1/portfolios/:portfolioId/scenarios", () => {
    it("creates an empty DRAFT scenario", async () => {
      const response = await request(app)
        .post(scenariosUrl())
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Rate cut", description: "What if rates fall?" });

      expect(response.status).toBe(201);
      const { data } = body<DataEnvelope<ScenarioDto>>(response);
      expect(data.portfolioId).toBe(portfolioId);
      expect(data.name).toBe("Rate cut");
      expect(data.description).toBe("What if rates fall?");
      expect(data.status).toBe("DRAFT");
      expect(data.changes).toEqual([]);
    });

    it("creates a scenario with its changes and can read them back", async () => {
      const response = await request(app)
        .post(scenariosUrl())
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "With changes",
          changes: [
            { assetId: assetAId, percentChange: 10 },
            { assetId: assetBId, percentChange: -5 },
          ],
        });

      expect(response.status).toBe(201);
      const created = body<DataEnvelope<ScenarioDto>>(response).data;
      const expected = [
        { assetId: assetAId, percentChange: 10 },
        { assetId: assetBId, percentChange: -5 },
      ];
      expect(created.changes).toEqual(expected);
      expect((await fetchScenario(created.id)).changes).toEqual(expected);
    });

    it("trims the name", async () => {
      const response = await request(app)
        .post(scenariosUrl())
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "  Padded name  " });

      expect(response.status).toBe(201);
      expect(body<DataEnvelope<ScenarioDto>>(response).data.name).toBe("Padded name");
    });

    it("can be calculated right after creation", async () => {
      const created = await request(app)
        .post(scenariosUrl())
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Calculable", changes: [{ assetId: assetAId, percentChange: 10 }] });
      const { id } = body<DataEnvelope<ScenarioDto>>(created).data;

      const response = await request(app)
        .post(`${scenarioUrl(id)}/calculate`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<CalculationDto>>(response).data.difference.totalValue).toEqual({
        amount: "100",
        currency: "USD",
      });
    });

    it("does not modify the baseline portfolio", async () => {
      await request(app)
        .post(scenariosUrl())
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Isolated", changes: [{ assetId: assetAId, percentChange: -50 }] });

      const positions = await prisma.position.findMany({ where: { portfolioId } });
      expect(positions).toHaveLength(1);
      expect(positions[0]?.currentPrice.toString()).toBe("100");
      expect(positions[0]?.quantity.toString()).toBe("10");
    });

    it("rejects a missing or blank name with 400", async () => {
      const missing = await request(app)
        .post(scenariosUrl())
        .set("Authorization", `Bearer ${token}`)
        .send({});
      const blank = await request(app)
        .post(scenariosUrl())
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "   " });

      expect(missing.status).toBe(400);
      expect(blank.status).toBe(400);
      expect(body<ErrorEnvelope>(blank).error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a percentage below -100% with 400", async () => {
      const response = await request(app)
        .post(scenariosUrl())
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Impossible", changes: [{ assetId: assetAId, percentChange: -150 }] });

      expect(response.status).toBe(400);
      expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects the same asset appearing twice with 400", async () => {
      const response = await request(app)
        .post(scenariosUrl())
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Duplicated",
          changes: [
            { assetId: assetAId, percentChange: 5 },
            { assetId: assetAId, percentChange: -5 },
          ],
        });

      expect(response.status).toBe(400);
      expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a non-numeric percentage with 400", async () => {
      const response = await request(app)
        .post(scenariosUrl())
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Text", changes: [{ assetId: assetAId, percentChange: "ten" }] });

      expect(response.status).toBe(400);
    });

    it("reports every unknown asset in a single 400", async () => {
      const response = await request(app)
        .post(scenariosUrl())
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Unknown assets",
          changes: [
            { assetId: assetAId, percentChange: 5 },
            { assetId: UNKNOWN_ASSET_ID, percentChange: 5 },
            { assetId: NON_EXISTENT_ID, percentChange: 5 },
          ],
        });

      expect(response.status).toBe(400);
      const { error } = body<ErrorEnvelope>(response);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details?.map((d) => d.code)).toEqual(["UNKNOWN_ASSET", "UNKNOWN_ASSET"]);
    });

    it("returns 404 for a portfolio owned by another user", async () => {
      const response = await request(app)
        .post(scenariosUrl())
        .set("Authorization", `Bearer ${otherUserToken}`)
        .send({ name: "Not mine" });

      expect(response.status).toBe(404);
    });

    it("returns 401 without a token", async () => {
      const response = await request(app).post(scenariosUrl()).send({ name: "Anonymous" });

      expect(response.status).toBe(401);
    });
  });

  describe("PATCH /api/v1/portfolios/:portfolioId/scenarios/:scenarioId", () => {
    function patch(scenarioId: string, payload: object, authToken = token) {
      return request(app)
        .patch(scenarioUrl(scenarioId))
        .set("Authorization", `Bearer ${authToken}`)
        .send(payload);
    }

    it("renames a scenario and updates its description", async () => {
      const { id } = await createTestScenario(portfolioId, { name: "Before" });

      const response = await patch(id, { name: "After", description: "Now with a description" });

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<ScenarioDto>>(response);
      expect(data.name).toBe("After");
      expect(data.description).toBe("Now with a description");
    });

    it("replaces the variable changes", async () => {
      const { id } = await createTestScenario(portfolioId, {
        changes: [{ assetId: assetAId, percentChange: 10 }],
      });

      const response = await patch(id, {
        changes: [{ assetId: assetBId, percentChange: -20 }],
      });

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<ScenarioDto>>(response).data.changes).toEqual([
        { assetId: assetBId, percentChange: -20 },
      ]);
      expect((await fetchScenario(id)).changes).toEqual([
        { assetId: assetBId, percentChange: -20 },
      ]);
    });

    it("resets a scenario by sending an empty list of changes", async () => {
      const { id } = await createTestScenario(portfolioId, {
        changes: [{ assetId: assetAId, percentChange: 10 }],
      });

      const response = await patch(id, { changes: [] });

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<ScenarioDto>>(response).data.changes).toEqual([]);
    });

    it("saves a scenario by setting its status to SAVED", async () => {
      const { id } = await createTestScenario(portfolioId, { status: "DRAFT" });

      const response = await patch(id, { status: "SAVED" });

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<ScenarioDto>>(response).data.status).toBe("SAVED");
    });

    it("keeps the fields that are not sent", async () => {
      const { id } = await createTestScenario(portfolioId, {
        name: "Keep me",
        changes: [{ assetId: assetAId, percentChange: 3 }],
      });

      await patch(id, { status: "SAVED" });
      const after = await fetchScenario(id);

      expect(after.name).toBe("Keep me");
      expect(after.changes).toEqual([{ assetId: assetAId, percentChange: 3 }]);
    });

    it("updates name and changes together", async () => {
      const { id } = await createTestScenario(portfolioId, { name: "Old name" });

      const response = await patch(id, {
        name: "New name",
        changes: [{ assetId: assetAId, percentChange: 12 }],
      });

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<ScenarioDto>>(response);
      expect(data.name).toBe("New name");
      expect(data.changes).toEqual([{ assetId: assetAId, percentChange: 12 }]);
    });

    it("changes nothing when part of the request is invalid", async () => {
      const { id } = await createTestScenario(portfolioId, {
        name: "Untouched name",
        changes: [{ assetId: assetAId, percentChange: 1 }],
      });

      const response = await patch(id, {
        name: "Should not be applied",
        changes: [{ assetId: UNKNOWN_ASSET_ID, percentChange: 5 }],
      });

      expect(response.status).toBe(400);
      const after = await fetchScenario(id);
      expect(after.name).toBe("Untouched name");
      expect(after.changes).toEqual([{ assetId: assetAId, percentChange: 1 }]);
    });

    it("rejects an empty body with 400", async () => {
      const { id } = await createTestScenario(portfolioId);

      const response = await patch(id, {});

      expect(response.status).toBe(400);
      expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
    });

    it("does not accept ARCHIVED as a status (use the archive endpoint)", async () => {
      const { id } = await createTestScenario(portfolioId);

      const response = await patch(id, { status: "ARCHIVED" });

      expect(response.status).toBe(400);
    });

    it("rejects invalid changes with 400", async () => {
      const { id } = await createTestScenario(portfolioId);

      const response = await patch(id, {
        changes: [{ assetId: assetAId, percentChange: -101 }],
      });

      expect(response.status).toBe(400);
      expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 409 when the scenario is archived", async () => {
      const { id } = await createTestScenario(portfolioId, { status: "ARCHIVED" });

      const response = await patch(id, { name: "Too late" });

      expect(response.status).toBe(409);
      expect(body<ErrorEnvelope>(response).error.code).toBe("CONFLICT");
    });

    it("returns 404 for a scenario that does not exist", async () => {
      const response = await patch(NON_EXISTENT_ID, { name: "Ghost" });

      expect(response.status).toBe(404);
    });

    it("returns 404 when the scenario belongs to a different portfolio", async () => {
      const { id } = await createTestScenario(portfolioId);

      const response = await request(app)
        .patch(scenarioUrl(id, otherPortfolioId))
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Wrong portfolio" });

      expect(response.status).toBe(404);
    });

    it("returns 404 for another user's portfolio and leaves the scenario intact", async () => {
      const { id } = await createTestScenario(portfolioId, { name: "Protected" });

      const response = await patch(id, { name: "Hijacked" }, otherUserToken);

      expect(response.status).toBe(404);
      expect((await fetchScenario(id)).name).toBe("Protected");
    });

    it("returns 401 without a token", async () => {
      const { id } = await createTestScenario(portfolioId);

      const response = await request(app).patch(scenarioUrl(id)).send({ name: "Anonymous" });

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/v1/portfolios/:portfolioId/scenarios/:scenarioId/archive", () => {
    function archive(scenarioId: string, forPortfolioId = portfolioId, authToken = token) {
      return request(app)
        .post(`${scenarioUrl(scenarioId, forPortfolioId)}/archive`)
        .set("Authorization", `Bearer ${authToken}`);
    }

    it("archives a scenario", async () => {
      const { id } = await createTestScenario(portfolioId, { status: "SAVED" });

      const response = await archive(id);

      expect(response.status).toBe(200);
      const envelope = body<DataMetaEnvelope<ScenarioDto, { alreadyArchived: boolean }>>(response);
      expect(envelope.data.status).toBe("ARCHIVED");
      expect(envelope.meta.alreadyArchived).toBe(false);
    });

    it("is idempotent: archiving again succeeds and reports it", async () => {
      const { id } = await createTestScenario(portfolioId);
      await archive(id);

      const response = await archive(id);

      expect(response.status).toBe(200);
      const envelope = body<DataMetaEnvelope<ScenarioDto, { alreadyArchived: boolean }>>(response);
      expect(envelope.data.status).toBe("ARCHIVED");
      expect(envelope.meta.alreadyArchived).toBe(true);
    });

    it("keeps the scenario's changes", async () => {
      const { id } = await createTestScenario(portfolioId, {
        changes: [{ assetId: assetAId, percentChange: 4 }],
      });

      await archive(id);

      expect((await fetchScenario(id)).changes).toEqual([{ assetId: assetAId, percentChange: 4 }]);
    });

    it("returns 404 for a scenario that does not exist", async () => {
      expect((await archive(NON_EXISTENT_ID)).status).toBe(404);
    });

    it("returns 404 when the scenario belongs to a different portfolio", async () => {
      const { id } = await createTestScenario(portfolioId);

      expect((await archive(id, otherPortfolioId)).status).toBe(404);
    });

    it("returns 404 for another user's portfolio and leaves the scenario intact", async () => {
      const { id } = await createTestScenario(portfolioId, { status: "SAVED" });

      const response = await archive(id, portfolioId, otherUserToken);

      expect(response.status).toBe(404);
      expect((await fetchScenario(id)).status).toBe("SAVED");
    });

    it("returns 401 without a token", async () => {
      const { id } = await createTestScenario(portfolioId);

      const response = await request(app).post(`${scenarioUrl(id)}/archive`);

      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /api/v1/portfolios/:portfolioId/scenarios/:scenarioId", () => {
    function remove(scenarioId: string, forPortfolioId = portfolioId, authToken = token) {
      return request(app)
        .delete(scenarioUrl(scenarioId, forPortfolioId))
        .set("Authorization", `Bearer ${authToken}`);
    }

    it("deletes a scenario", async () => {
      const { id } = await createTestScenario(portfolioId);

      const response = await remove(id);

      expect(response.status).toBe(204);
      const afterwards = await request(app)
        .get(scenarioUrl(id))
        .set("Authorization", `Bearer ${token}`);
      expect(afterwards.status).toBe(404);
    });

    it("deletes an archived scenario too", async () => {
      const { id } = await createTestScenario(portfolioId, { status: "ARCHIVED" });

      expect((await remove(id)).status).toBe(204);
    });

    it("returns 404 when deleting the same scenario twice", async () => {
      const { id } = await createTestScenario(portfolioId);
      await remove(id);

      expect((await remove(id)).status).toBe(404);
    });

    it("returns 404 for a scenario that does not exist", async () => {
      expect((await remove(NON_EXISTENT_ID)).status).toBe(404);
    });

    it("returns 404 when the scenario belongs to a different portfolio", async () => {
      const { id } = await createTestScenario(portfolioId);

      expect((await remove(id, otherPortfolioId)).status).toBe(404);
      expect((await fetchScenario(id)).id).toBe(id);
    });

    it("returns 404 for another user's portfolio and leaves the scenario intact", async () => {
      const { id } = await createTestScenario(portfolioId, { name: "Still here" });

      const response = await remove(id, portfolioId, otherUserToken);

      expect(response.status).toBe(404);
      expect((await fetchScenario(id)).name).toBe("Still here");
    });

    it("returns 401 without a token", async () => {
      const { id } = await createTestScenario(portfolioId);

      const response = await request(app).delete(scenarioUrl(id));

      expect(response.status).toBe(401);
    });
  });
});

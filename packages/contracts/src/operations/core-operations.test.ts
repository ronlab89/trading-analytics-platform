/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/dot-notation --
   The tests read a generated JSON document by path, so its nodes are untyped on purpose. */
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "../openapi.js";
import {
  decisionOperations,
  portfolioOperations,
  scenarioOperations,
  transactionOperations,
} from "./index.js";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const operations = [
  ...portfolioOperations,
  ...transactionOperations,
  ...decisionOperations,
  ...scenarioOperations,
];
const document: Json = buildOpenApiDocument(operations, { title: "Trading API", version: "1" });
const paths: Json = document["paths"];

describe("the core operations", () => {
  it("cover the 25 endpoints of portfolios, positions, transactions, jobs, decisions and scenarios", () => {
    expect(operations).toHaveLength(25);
  });

  it("accept the optional Idempotency-Key on a transaction and on an import", () => {
    for (const path of [
      "/api/v1/portfolios/{portfolioId}/transactions",
      "/api/v1/portfolios/{portfolioId}/imports",
    ]) {
      const operation = paths[path].post;

      expect(operation.parameters).toContainEqual(
        expect.objectContaining({ name: "Idempotency-Key", in: "header", required: false }),
      );
      expect(operation.responses["201"] ?? operation.responses["202"]).toHaveProperty("headers");
      expect(
        (operation.responses["201"] ?? operation.responses["202"]).headers["Idempotency-Replayed"],
      ).toBeDefined();
    }
  });

  it("takes the import as text/csv, answers 202 with a Location and may answer 413", () => {
    const operation = paths["/api/v1/portfolios/{portfolioId}/imports"].post;

    expect(Object.keys(operation.requestBody.content as object)).toEqual(["text/csv"]);
    expect(operation.responses["202"].headers.Location).toBeDefined();
    expect(operation.responses["413"]).toBeDefined();
  });

  it("flags a repeated archive in meta, for a portfolio and for a scenario", () => {
    for (const path of [
      "/api/v1/portfolios/{portfolioId}/archive",
      "/api/v1/portfolios/{portfolioId}/scenarios/{scenarioId}/archive",
    ]) {
      const schema = paths[path].post.responses["200"].content["application/json"].schema;

      expect(schema.properties.meta.properties).toHaveProperty("alreadyArchived");
    }
  });

  it("answers a deleted scenario with a 204 and no body", () => {
    const response =
      paths["/api/v1/portfolios/{portfolioId}/scenarios/{scenarioId}"].delete.responses["204"];

    expect(response.content).toBeUndefined();
  });

  it("lists the transactions as a page, and the other lists as plain data", () => {
    const meta = (path: string) =>
      paths[path].get.responses["200"].content["application/json"].schema.properties.meta;

    expect(meta("/api/v1/portfolios/{portfolioId}/transactions")).toBeDefined();
    expect(meta("/api/v1/portfolios/{portfolioId}/positions")).toBeUndefined();
    expect(meta("/api/v1/portfolios/{portfolioId}/decisions")).toBeUndefined();
  });

  it("puts the fixed compare path beside the scenario id path", () => {
    expect(paths["/api/v1/portfolios/{portfolioId}/scenarios/compare"].post).toBeDefined();
    expect(paths["/api/v1/portfolios/{portfolioId}/scenarios/{scenarioId}"].get).toBeDefined();
  });
});

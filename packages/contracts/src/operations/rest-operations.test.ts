/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/dot-notation --
   The tests read a generated JSON document by path, so its nodes are untyped on purpose. */
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "../openapi.js";
import { API_OPERATIONS } from "./index.js";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const document: Json = buildOpenApiDocument(API_OPERATIONS, { title: "Trading API", version: "1" });
const paths: Json = document["paths"];

function parameterNames(path: string, method: string): string[] {
  const parameters: Json[] = paths[path][method].parameters ?? [];
  return parameters.map((parameter) => String(parameter["name"]));
}

describe("the whole registry", () => {
  it("describes the 55 routes of the routers and the 3 service endpoints", () => {
    expect(API_OPERATIONS).toHaveLength(58);
  });

  it("leaves only the login, the refresh, the logout and the service endpoints public", () => {
    const publicIds = API_OPERATIONS.filter((operation) => !operation.authenticated)
      .map((operation) => operation.operationId)
      .sort();

    expect(publicIds).toEqual([
      "getLiveness",
      "getReadiness",
      "getServiceInfo",
      "login",
      "logout",
      "refreshSession",
    ]);
  });
});

describe("auth", () => {
  it("sets the refresh cookie on login and reads it, with the client header, on refresh and logout", () => {
    expect(paths["/api/v1/auth/login"].post.responses["200"].headers["Set-Cookie"]).toBeDefined();

    for (const path of ["/api/v1/auth/refresh", "/api/v1/auth/logout"]) {
      expect(paths[path].post.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "X-Requested-With", in: "header", required: true }),
          expect.objectContaining({ name: "refresh_token", in: "cookie", required: true }),
        ]),
      );
    }
  });

  it("returns the user alone from /me, with no session", () => {
    const schema =
      paths["/api/v1/auth/me"].get.responses["200"].content["application/json"].schema.properties
        .data;

    expect(Object.keys(schema.properties as object)).toEqual(["user"]);
  });
});

describe("queries", () => {
  it("lists the query parameters of the assets, the prices and the history", () => {
    expect(parameterNames("/api/v1/assets", "get")).toEqual(
      expect.arrayContaining(["search", "assetType", "page", "pageSize"]),
    );
    expect(parameterNames("/api/v1/market/prices", "get")).toEqual(["assetIds"]);
    expect(parameterNames("/api/v1/assets/{assetId}/history", "get")).toEqual(
      expect.arrayContaining(["assetId", "from", "to", "interval"]),
    );
  });

  it("describes the comma-separated assetIds as one string, as the client sends it", () => {
    const parameter = paths["/api/v1/market/prices"].get.parameters[0];

    expect(parameter.required).toBe(true);
    expect(parameter.schema.type).toBe("string");
  });

  it("lists the period and grouping parameters of the analytics", () => {
    expect(parameterNames("/api/v1/portfolios/{portfolioId}/analytics/attribution", "get")).toEqual(
      expect.arrayContaining(["portfolioId", "period", "from", "to", "groupBy"]),
    );
    expect(parameterNames("/api/v1/portfolios/{portfolioId}/analytics/risk", "get")).toEqual(
      expect.arrayContaining(["portfolioId", "period", "from", "to"]),
    );
  });

  it("lists unreadOnly on the notifications", () => {
    expect(parameterNames("/api/v1/notifications", "get")).toEqual(["unreadOnly"]);
  });
});

describe("responses", () => {
  it("offers the current and the range attribution as the two possible answers", () => {
    const data =
      paths["/api/v1/portfolios/{portfolioId}/analytics/attribution"].get.responses["200"].content[
        "application/json"
      ].schema.properties.data;

    expect((data.anyOf ?? data.oneOf).length).toBe(2);
  });

  it("allows null preferences until the first save", () => {
    const data =
      paths["/api/v1/preferences"].get.responses["200"].content["application/json"].schema
        .properties.data;

    expect(JSON.stringify(data)).toContain('"null"');
  });

  it("answers readiness with the same body for 200 and 503, and without the data envelope", () => {
    const responses = paths["/health/ready"].get.responses;
    const ok = responses["200"].content["application/json"].schema;
    const unavailable = responses["503"].content["application/json"].schema;

    expect(ok).toEqual(unavailable);
    expect(ok.properties).not.toHaveProperty("data");
    expect(ok.properties).toHaveProperty("status");
  });

  it("answers 403 on the simulation controls and names the permission", () => {
    for (const [path, method] of [
      ["/api/v1/simulation/start", "post"],
      ["/api/v1/simulation/pause", "post"],
      ["/api/v1/simulation/mode", "put"],
    ] as const) {
      expect(paths[path][method].responses["403"]).toBeDefined();
      expect(paths[path][method].description).toContain("simulation:control");
    }
  });

  it("answers the service endpoints with no security requirement", () => {
    for (const path of ["/", "/health", "/health/ready"]) {
      expect(paths[path].get.security).toEqual([]);
    }
  });
});

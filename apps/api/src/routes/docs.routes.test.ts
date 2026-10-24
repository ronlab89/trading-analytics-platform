import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { API_OPERATIONS } from "@trading/contracts";
import { createApp } from "../app.js";
import { createDocsRouter, DEFAULT_VIEWER_CDN } from "./docs.routes.js";

interface Document {
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
  components: { securitySchemes: Record<string, unknown> };
}

function policyOf(response: { headers: Record<string, string | undefined> }): string {
  return response.headers["content-security-policy"] ?? "";
}

function nonceOf(policy: string): string {
  return /'nonce-([^']+)'/.exec(policy)?.[1] ?? "";
}

describe("the OpenAPI document and the viewer when the docs are on", () => {
  const app = createApp({ docsEnabled: true });

  it("serves the document generated from the operations", async () => {
    const response = await request(app).get("/openapi.json");
    const document = response.body as Document;

    expect(response.status).toBe(200);
    expect(response.type).toBe("application/json");
    expect(document.openapi).toBe("3.1.0");
    expect(Object.values(document.paths).flatMap((item) => Object.keys(item))).toHaveLength(
      API_OPERATIONS.length,
    );
  });

  it("declares the bearer token as the security scheme, with no credential in the document", async () => {
    const response = await request(app).get("/openapi.json");
    const document = response.body as Document;

    expect(document.components.securitySchemes).toEqual({
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    });
    expect(JSON.stringify(document)).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });

  it("serves the viewer pointed at the document", async () => {
    const response = await request(app).get("/api/docs");

    expect(response.status).toBe(200);
    expect(response.type).toBe("text/html");
    expect(response.text).toContain('"url": "/openapi.json"');
    expect(response.text).toContain(DEFAULT_VIEWER_CDN);
  });

  it("allows the script of the viewer by nonce, with no unsafe-eval and no inline script without it", async () => {
    const response = await request(app).get("/api/docs");
    const policy = policyOf(response);
    const nonce = nonceOf(policy);

    expect(nonce).not.toBe("");
    expect(policy).toContain("script-src 'nonce-");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(policy).toContain("connect-src 'self'");
    expect(
      response.text.match(/<script[^>]*>/g)?.every((tag) => tag.includes(`nonce="${nonce}"`)),
    ).toBe(true);
  });

  it("uses a new nonce for every page", async () => {
    const first = await request(app).get("/api/docs");
    const second = await request(app).get("/api/docs");

    expect(nonceOf(policyOf(first))).not.toBe(nonceOf(policyOf(second)));
  });

  it("keeps the strict policy of helmet on every other route", async () => {
    const response = await request(app).get("/health");
    const policy = policyOf(response);

    expect(policy).toContain("default-src 'self'");
    expect(policy).not.toContain("jsdelivr");
    expect(policy).not.toContain("nonce-");
  });

  it("loads the viewer from the CDN of the configuration and allows only that origin", async () => {
    const custom = express();
    custom.use(createDocsRouter({ cdnUrl: "https://assets.example.com/scalar/viewer.js" }));

    const response = await request(custom).get("/api/docs");
    const policy = policyOf(response);

    expect(response.text).toContain("https://assets.example.com/scalar/viewer.js");
    expect(response.text).not.toContain("jsdelivr");
    expect(policy).toContain("script-src 'nonce-");
    expect(policy).toContain("https://assets.example.com");
    expect(policy).not.toContain("jsdelivr");
  });
});

describe("the OpenAPI document and the viewer when the docs are off", () => {
  const app = createApp({ docsEnabled: false });

  it.each(["/openapi.json", "/api/docs"])(
    "answers %s with the normal 404 envelope",
    async (path) => {
      const response = await request(app).get(path);
      const body = response.body as { error: { code: string; requestId: string } };

      expect(response.status).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.requestId).toBeDefined();
    },
  );
});

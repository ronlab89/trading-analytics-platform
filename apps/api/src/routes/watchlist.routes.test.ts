import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { body, type DataEnvelope, type ErrorEnvelope } from "../test-utils/api-client.js";
import { tokenFor } from "../test-utils/auth.js";
import { cleanupTestData, createTestAsset, createTestUser } from "../test-utils/fixtures.js";

interface WatchlistItemDto {
  id: string;
  userId: string;
  assetId: string;
}

/**
 * Integration tests for the watchlist.
 * Source: FR-022/023, 05-data-model.md §17 (no duplicates per user),
 * 09-security-spec.md §14-15 (resource ownership).
 */
describe("watchlist", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let ownerToken: string;
  let otherToken: string;

  beforeAll(async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    userIds.push(owner.user.id, other.user.id);

    ownerToken = tokenFor(owner.user.id);
    otherToken = tokenFor(other.user.id);
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  async function newAssetId(): Promise<string> {
    const asset = await createTestAsset("WL");
    assetIds.push(asset.id);
    return asset.id;
  }

  it.each([
    ["get", "/api/v1/watchlist"],
    ["post", "/api/v1/watchlist"],
    ["delete", "/api/v1/watchlist/some-asset-id"],
  ] as const)("rejects unauthenticated %s %s with 401", async (method, path) => {
    const response = await request(app)[method](path);

    expect(response.status).toBe(401);
    expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
  });

  it("adds an asset to the caller's watchlist and lists it", async () => {
    const assetId = await newAssetId();

    const added = await request(app)
      .post("/api/v1/watchlist")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assetId });

    expect(added.status).toBe(201);
    expect(body<DataEnvelope<WatchlistItemDto>>(added).data.assetId).toBe(assetId);

    const listed = await request(app)
      .get("/api/v1/watchlist")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(listed.status).toBe(200);
    expect(
      body<DataEnvelope<WatchlistItemDto[]>>(listed).data.some((i) => i.assetId === assetId),
    ).toBe(true);
  });

  it("only lists the caller's own watchlist entries", async () => {
    const assetId = await newAssetId();
    await request(app)
      .post("/api/v1/watchlist")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assetId });

    const asOther = await request(app)
      .get("/api/v1/watchlist")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(
      body<DataEnvelope<WatchlistItemDto[]>>(asOther).data.some((i) => i.assetId === assetId),
    ).toBe(false);
  });

  it("allows different users to watch the same asset (uniqueness is per user)", async () => {
    const assetId = await newAssetId();

    const first = await request(app)
      .post("/api/v1/watchlist")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assetId });
    const second = await request(app)
      .post("/api/v1/watchlist")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ assetId });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it("rejects adding the same asset twice for one user (400)", async () => {
    const assetId = await newAssetId();
    const add = () =>
      request(app)
        .post("/api/v1/watchlist")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ assetId });

    expect((await add()).status).toBe(201);

    const duplicate = await add();
    expect(duplicate.status).toBe(400);
    expect(body<ErrorEnvelope>(duplicate).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when adding an asset that does not exist", async () => {
    const response = await request(app)
      .post("/api/v1/watchlist")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assetId: "asset-that-does-not-exist" });

    expect(response.status).toBe(404);
    expect(body<ErrorEnvelope>(response).error.code).toBe("NOT_FOUND");
  });

  it("rejects a request body without assetId (400, field-level detail)", async () => {
    const response = await request(app)
      .post("/api/v1/watchlist")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect(response.status).toBe(400);
    const { error } = body<ErrorEnvelope>(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details?.some((d) => d.field === "assetId")).toBe(true);
  });

  it("removes an asset, then returns 404 on a repeated removal", async () => {
    const assetId = await newAssetId();
    await request(app)
      .post("/api/v1/watchlist")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assetId });

    const first = await request(app)
      .delete(`/api/v1/watchlist/${assetId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    const second = await request(app)
      .delete(`/api/v1/watchlist/${assetId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(first.status).toBe(204);
    expect(second.status).toBe(404);
  });

  it("cannot remove another user's watchlist entry (404, entry untouched)", async () => {
    const assetId = await newAssetId();
    await request(app)
      .post("/api/v1/watchlist")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assetId });

    const attempt = await request(app)
      .delete(`/api/v1/watchlist/${assetId}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(attempt.status).toBe(404);

    const listed = await request(app)
      .get("/api/v1/watchlist")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(
      body<DataEnvelope<WatchlistItemDto[]>>(listed).data.some((i) => i.assetId === assetId),
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { buildPaginationMeta, paginationMetaSchema } from "./pagination.schema.js";

describe("pagination meta", () => {
  it("computes totalPages by rounding up", () => {
    expect(buildPaginationMeta(1, 20, 41)).toEqual({
      page: 1,
      pageSize: 20,
      total: 41,
      totalPages: 3,
    });
    expect(buildPaginationMeta(1, 20, 0).totalPages).toBe(0);
  });

  it("validates built meta and rejects malformed meta", () => {
    expect(paginationMetaSchema.safeParse(buildPaginationMeta(2, 10, 25)).success).toBe(true);
    expect(paginationMetaSchema.safeParse({ page: 1 }).success).toBe(false);
  });
});

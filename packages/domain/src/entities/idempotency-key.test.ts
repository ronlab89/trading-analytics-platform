import { describe, expect, it } from "vitest";
import {
  IDEMPOTENCY_KEY_MAX_LENGTH,
  InvalidIdempotencyKeyError,
  validateIdempotencyReservation,
} from "./idempotency-key";

const valid = {
  userId: "user_1",
  key: "key-1",
  requestHash: "abc123",
  leaseExpiresAt: new Date("2026-10-21T10:01:00Z"),
  expiresAt: new Date("2026-10-22T10:00:00Z"),
};

describe("validateIdempotencyReservation", () => {
  it("should accept a valid reservation", () => {
    expect(() => {
      validateIdempotencyReservation(valid);
    }).not.toThrow();
  });

  it("should accept a key at the length limit", () => {
    expect(() => {
      validateIdempotencyReservation({ ...valid, key: "k".repeat(IDEMPOTENCY_KEY_MAX_LENGTH) });
    }).not.toThrow();
  });

  it.each([
    ["userId", { userId: "" }],
    ["key", { key: "   " }],
    ["key", { key: "k".repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1) }],
    ["request hash", { requestHash: "" }],
    ["lease", { leaseExpiresAt: new Date("not a date") }],
    ["expiry", { expiresAt: new Date("not a date") }],
  ])("should reject a missing or invalid %s", (_field, override) => {
    expect(() => {
      validateIdempotencyReservation({ ...valid, ...override });
    }).toThrow(InvalidIdempotencyKeyError);
  });
});

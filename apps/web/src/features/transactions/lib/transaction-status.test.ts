import { describe, expect, it } from "vitest";
import { transactionDisplayStatus } from "./transaction-status";

describe("transactionDisplayStatus", () => {
  it("shows a completed transaction as settled", () => {
    expect(transactionDisplayStatus("COMPLETED")).toBe("settled");
  });

  it("shows a failed transaction as failed", () => {
    expect(transactionDisplayStatus("FAILED")).toBe("failed");
  });

  it.each(["DRAFT", "VALIDATING", "PROCESSING"] as const)(
    "shows a %s transaction as pending",
    (status) => {
      expect(transactionDisplayStatus(status)).toBe("pending");
    },
  );
});

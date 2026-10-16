import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import {
  archiveMetaSchema,
  dataEnvelope,
  moneySchema,
  pageEnvelope,
  presentMoney,
  presentTimestamp,
} from "./response-common.schema.js";
import { z } from "zod";

describe("response common schemas", () => {
  it("presents Money as a decimal string plus currency, matching its JSON form", () => {
    const money = Money.of("1234.5000", "USD");
    const dto = presentMoney(money);
    expect(dto).toEqual({ amount: "1234.5", currency: "USD" });
    expect(dto).toEqual(JSON.parse(JSON.stringify(money)));
    expect(moneySchema.safeParse(dto).success).toBe(true);
  });

  it("presents a Date as the same ISO string Date#toJSON produces", () => {
    const date = new Date("2026-10-13T12:00:00.123Z");
    expect(presentTimestamp(date)).toBe("2026-10-13T12:00:00.123Z");
    expect(presentTimestamp(date)).toBe(JSON.parse(JSON.stringify(date)));
  });

  it("rejects a numeric money amount", () => {
    expect(moneySchema.safeParse({ amount: 1, currency: "USD" }).success).toBe(false);
  });

  it.each(["5e-8", "1E3", "", "abc", "1,5", " 1", "1."])(
    "rejects the money amount %j (not a fixed-notation decimal)",
    (amount) => {
      expect(moneySchema.safeParse({ amount, currency: "USD" }).success).toBe(false);
    },
  );

  it.each(["0", "-12.3", "877", "0.00000005"])("accepts the money amount %j", (amount) => {
    expect(moneySchema.safeParse({ amount, currency: "USD" }).success).toBe(true);
  });

  it("builds data and page envelopes", () => {
    expect(dataEnvelope(z.string()).safeParse({ data: "x" }).success).toBe(true);
    const page = pageEnvelope(z.string());
    const meta = { page: 1, pageSize: 20, total: 1, totalPages: 1 };
    expect(page.safeParse({ data: ["x"], meta }).success).toBe(true);
    expect(page.safeParse({ data: ["x"] }).success).toBe(false);
    expect(archiveMetaSchema.safeParse({ alreadyArchived: false }).success).toBe(true);
  });
});

import { createTransactionRequestSchema } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import {
  emptyTransactionForm,
  toCreateTransactionBody,
  todayInputValue,
  transactionFormSchema,
  type TransactionFormValues,
} from "./transaction-form";

const now = new Date(2026, 9, 14, 9, 30);

const valid: TransactionFormValues = {
  type: "BUY",
  assetId: "a1",
  executedAt: "2026-10-05",
  quantity: "10",
  price: "180.20",
  fees: "1.00",
};

function failedFields(values: TransactionFormValues) {
  const result = transactionFormSchema.safeParse(values);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path[0]);
}

describe("transactionFormSchema", () => {
  it("starts with today's date and nothing else chosen", () => {
    expect(emptyTransactionForm(now)).toEqual({
      type: "",
      assetId: "",
      executedAt: "2026-10-14",
      quantity: "",
      price: "",
      fees: "",
    });
    expect(failedFields(emptyTransactionForm(now))).toEqual([
      "type",
      "assetId",
      "quantity",
      "price",
    ]);
  });

  it("accepts a buy and a sale, with or without fees", () => {
    expect(transactionFormSchema.safeParse(valid).success).toBe(true);
    expect(transactionFormSchema.safeParse({ ...valid, type: "SELL", fees: "" }).success).toBe(
      true,
    );
  });

  it("rejects a type that is neither a buy nor a sale", () => {
    expect(failedFields({ ...valid, type: "DEPOSIT" })).toEqual(["type"]);
  });

  it("rejects an asset of spaces", () => {
    expect(failedFields({ ...valid, assetId: "   " })).toEqual(["assetId"]);
  });

  it.each(["", "0", "0.0", "-1", "abc", "1,5", "1e3", " "])(
    "rejects %j as a quantity and as a price",
    (value) => {
      expect(failedFields({ ...valid, quantity: value })).toEqual(["quantity"]);
      expect(failedFields({ ...valid, price: value })).toEqual(["price"]);
    },
  );

  it("accepts a fraction in the quantity and in the price", () => {
    expect(
      transactionFormSchema.safeParse({ ...valid, quantity: "0.5", price: "0.00001234" }).success,
    ).toBe(true);
  });

  it("accepts zero fees, but not a negative or a text one", () => {
    expect(transactionFormSchema.safeParse({ ...valid, fees: "0" }).success).toBe(true);
    expect(failedFields({ ...valid, fees: "-1" })).toEqual(["fees"]);
    expect(failedFields({ ...valid, fees: "abc" })).toEqual(["fees"]);
  });

  it("rejects a day that does not exist or is not written as a date", () => {
    expect(failedFields({ ...valid, executedAt: "2026-02-31" })).toEqual(["executedAt"]);
    expect(failedFields({ ...valid, executedAt: "" })).toEqual(["executedAt"]);
    expect(failedFields({ ...valid, executedAt: "14 oct 2026" })).toEqual(["executedAt"]);
  });
});

describe("todayInputValue", () => {
  it("writes the day with two digits for the month and the day", () => {
    expect(todayInputValue(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("toCreateTransactionBody", () => {
  const parsed = transactionFormSchema.parse(valid);

  it("builds a body the API accepts", () => {
    const body = toCreateTransactionBody(parsed, "USD", now);

    expect(createTransactionRequestSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      assetId: "a1",
      type: "BUY",
      quantity: 10,
      price: { amount: "180.20", currency: "USD" },
      fees: { amount: "1.00", currency: "USD" },
    });
  });

  it("leaves the fees out when the box is empty", () => {
    const body = toCreateTransactionBody(
      transactionFormSchema.parse({ ...valid, fees: "" }),
      "USD",
      now,
    );

    expect(body).not.toHaveProperty("fees");
  });

  it("sends the price as the text the person typed, not as a number", () => {
    const body = toCreateTransactionBody(
      transactionFormSchema.parse({ ...valid, price: "0.10" }),
      "USD",
      now,
    );

    expect(body.price.amount).toBe("0.10");
  });

  it("records today at this very moment", () => {
    const body = toCreateTransactionBody(
      transactionFormSchema.parse({ ...valid, executedAt: "2026-10-14" }),
      "USD",
      now,
    );

    expect(body.executedAt).toEqual(now);
  });

  it("records another day at noon in the person's time zone", () => {
    const body = toCreateTransactionBody(parsed, "USD", now);

    expect(body.executedAt).toEqual(new Date(2026, 9, 5, 12));
  });
});

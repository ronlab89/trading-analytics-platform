import { createPortfolioRequestSchema } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import {
  emptyPortfolioForm,
  portfolioFormSchema,
  toCreatePortfolioBody,
  type PortfolioFormValues,
} from "./portfolio-form";

const valid: PortfolioFormValues = {
  name: "Long term",
  description: "Retirement savings",
  baseCurrency: "USD",
};

function failedFields(values: PortfolioFormValues) {
  const result = portfolioFormSchema.safeParse(values);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path[0]);
}

describe("portfolioFormSchema", () => {
  it("starts empty, so the form begins with nothing chosen", () => {
    expect(emptyPortfolioForm).toEqual({ name: "", description: "", baseCurrency: "" });
    expect(failedFields(emptyPortfolioForm)).toEqual(["name", "baseCurrency"]);
  });

  it("accepts a name and a currency, with or without a description", () => {
    expect(portfolioFormSchema.safeParse(valid).success).toBe(true);
    expect(portfolioFormSchema.safeParse({ ...valid, description: "" }).success).toBe(true);
  });

  it("rejects a name that is only spaces, which the API would take as filled in", () => {
    expect(failedFields({ ...valid, name: "   " })).toEqual(["name"]);
  });

  it("trims the name", () => {
    expect(portfolioFormSchema.parse({ ...valid, name: "  Long term  " }).name).toBe("Long term");
  });

  it("rejects a currency that is not a 3-letter code", () => {
    expect(failedFields({ ...valid, baseCurrency: "" })).toEqual(["baseCurrency"]);
    expect(failedFields({ ...valid, baseCurrency: "US" })).toEqual(["baseCurrency"]);
  });
});

describe("toCreatePortfolioBody", () => {
  it("sends the trimmed description when there is one", () => {
    const values = portfolioFormSchema.parse({ ...valid, description: "  Retirement  " });

    expect(toCreatePortfolioBody(values)).toEqual({
      name: "Long term",
      baseCurrency: "USD",
      description: "Retirement",
    });
  });

  it("leaves the description out when it is blank", () => {
    const values = portfolioFormSchema.parse({ ...valid, description: "   " });

    expect(toCreatePortfolioBody(values)).toEqual({ name: "Long term", baseCurrency: "USD" });
  });

  it("builds a body the API contract accepts", () => {
    for (const description of ["", "Retirement"]) {
      const body = toCreatePortfolioBody(portfolioFormSchema.parse({ ...valid, description }));

      expect(createPortfolioRequestSchema.safeParse(body).success).toBe(true);
    }
  });
});

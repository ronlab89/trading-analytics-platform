import { createPortfolioRequestSchema, updatePortfolioRequestSchema } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import {
  emptyPortfolioForm,
  portfolioFormSchema,
  portfolioToFormValues,
  toCreatePortfolioBody,
  toUpdatePortfolioBody,
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

describe("portfolioToFormValues", () => {
  it("fills the form with what the portfolio has, a missing description as an empty box", () => {
    expect(
      portfolioToFormValues({ name: "Growth", description: null, baseCurrency: "EUR" }),
    ).toEqual({ name: "Growth", description: "", baseCurrency: "EUR" });
    expect(
      portfolioToFormValues({ name: "Growth", description: "Medium term", baseCurrency: "EUR" }),
    ).toEqual({ name: "Growth", description: "Medium term", baseCurrency: "EUR" });
  });
});

describe("toUpdatePortfolioBody", () => {
  const original = { name: "Growth", description: "Medium term" };
  const parsed = (values: Partial<PortfolioFormValues>) =>
    portfolioFormSchema.parse({ ...valid, name: "Growth", description: "Medium term", ...values });

  it("sends only what the user changed", () => {
    expect(toUpdatePortfolioBody(parsed({ name: "Global growth" }), original)).toEqual({
      name: "Global growth",
    });
    expect(toUpdatePortfolioBody(parsed({ description: "Long term" }), original)).toEqual({
      description: "Long term",
    });
    expect(
      toUpdatePortfolioBody(parsed({ name: "Global growth", description: "Long term" }), original),
    ).toEqual({ name: "Global growth", description: "Long term" });
  });

  it("sends nothing when the user changed nothing, spaces around the text included", () => {
    expect(toUpdatePortfolioBody(parsed({}), original)).toEqual({});
    expect(toUpdatePortfolioBody(parsed({ name: "  Growth  " }), original)).toEqual({});
  });

  it("clears the description with an empty text, and leaves a missing one alone", () => {
    expect(toUpdatePortfolioBody(parsed({ description: "" }), original)).toEqual({
      description: "",
    });
    expect(
      toUpdatePortfolioBody(parsed({ description: "" }), { ...original, description: null }),
    ).toEqual({});
  });

  it("builds a body the API contract accepts whenever it has something to send", () => {
    const body = toUpdatePortfolioBody(parsed({ name: "Global growth" }), original);

    expect(updatePortfolioRequestSchema.safeParse(body).success).toBe(true);
  });
});

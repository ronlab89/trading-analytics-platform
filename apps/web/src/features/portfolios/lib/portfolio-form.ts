import {
  createPortfolioRequestSchema,
  type CreatePortfolioRequestBody,
  type PortfolioResponse,
  type UpdatePortfolioRequestBody,
} from "@trading/contracts";
import { z } from "zod";

/**
 * What the portfolio form checks: the API's own create schema, plus what a form needs on top of
 * it. A name of spaces is blank to the user but not to the schema, so the name is trimmed first,
 * and an empty description is an empty text box, not a missing field. The messages are not shown:
 * the form picks its own, so they follow the language.
 */
export const portfolioFormSchema = createPortfolioRequestSchema.extend({
  name: z.string().trim().min(1),
  description: z.string().trim(),
});

/** What the inputs hold while the user types: all text, the currency empty until chosen. */
export type PortfolioFormValues = z.input<typeof portfolioFormSchema>;

export const emptyPortfolioForm: PortfolioFormValues = {
  name: "",
  description: "",
  baseCurrency: "",
};

/** The request body: a blank description is left out instead of sent empty. */
export function toCreatePortfolioBody(
  values: z.output<typeof portfolioFormSchema>,
): CreatePortfolioRequestBody {
  const { description, ...rest } = values;
  return description ? { ...rest, description } : rest;
}

/** The form filled in with what a portfolio has; a missing description is an empty text box. */
export function portfolioToFormValues(
  portfolio: Pick<PortfolioResponse, "name" | "description" | "baseCurrency">,
): PortfolioFormValues {
  return {
    name: portfolio.name,
    description: portfolio.description ?? "",
    baseCurrency: portfolio.baseCurrency,
  };
}

/**
 * The update body: only what the user changed. Clearing a description sends `""`, which the API
 * stores as none; clearing one that was already missing changes nothing. An empty body means there
 * is nothing to save. The base currency is never sent: the API fixes it at creation.
 */
export function toUpdatePortfolioBody(
  values: z.output<typeof portfolioFormSchema>,
  original: Pick<PortfolioResponse, "name" | "description">,
): UpdatePortfolioRequestBody {
  const body: UpdatePortfolioRequestBody = {};
  if (values.name !== original.name) body.name = values.name;
  if (values.description !== (original.description ?? "")) body.description = values.description;
  return body;
}

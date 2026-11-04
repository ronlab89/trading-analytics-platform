import type { UpdateScenarioRequestBody } from "@trading/contracts";
import { z } from "zod";

/** What the "Save scenario" form checks: a name that is not blank, and a description that may be. */
export const saveScenarioFormSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim(),
});

/** What the inputs hold while the user types. */
export type SaveScenarioFormValues = z.input<typeof saveScenarioFormSchema>;

/**
 * Saving a scenario names it and marks it as saved. A description the user left empty is not sent,
 * unless the scenario had one, so clearing it still reaches the API.
 */
export function toSaveScenarioBody(
  values: z.output<typeof saveScenarioFormSchema>,
  original: { description: string | null },
): UpdateScenarioRequestBody {
  const body: UpdateScenarioRequestBody = { name: values.name, status: "SAVED" };
  if (values.description !== "" || original.description !== null) {
    body.description = values.description;
  }
  return body;
}

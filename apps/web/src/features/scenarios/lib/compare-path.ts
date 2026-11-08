import { MAX_COMPARED_SCENARIOS } from "@trading/contracts";
import { MIN_COMPARED_SCENARIOS } from "./scenario-comparison";

export const COMPARE_PATH = "/decisions/lab/compare";

/** The address of the comparison of these scenarios; their order is the order of their letters. */
export function compareScenariosPath(scenarioIds: readonly string[]) {
  return `${COMPARE_PATH}?${new URLSearchParams({ ids: scenarioIds.join(",") }).toString()}`;
}

/**
 * The scenarios an address asks to compare, or null when it does not ask for a valid set: two to
 * five, none empty, none repeated.
 */
export function parseComparedIds(ids: string | null): string[] | null {
  const parsed = (ids ?? "").split(",").map((id) => id.trim());
  const valid =
    parsed.length >= MIN_COMPARED_SCENARIOS &&
    parsed.length <= MAX_COMPARED_SCENARIOS &&
    parsed.every((id) => id !== "") &&
    new Set(parsed).size === parsed.length;
  return valid ? parsed : null;
}

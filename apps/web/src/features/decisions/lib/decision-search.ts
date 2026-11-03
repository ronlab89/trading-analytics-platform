import type { DecisionRow } from "../types";

/**
 * The decisions that match what the user typed: the text is looked for, ignoring case, in the title,
 * the symbol and the name of the asset. Blank text matches everything.
 */
export function searchDecisions(rows: readonly DecisionRow[], text: string): DecisionRow[] {
  const needle = text.trim().toLowerCase();
  if (needle === "") return [...rows];

  return rows.filter((row) =>
    [row.title, row.symbol, row.name].some((field) => field?.toLowerCase().includes(needle)),
  );
}

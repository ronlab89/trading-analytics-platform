import type { AssetResponse } from "@trading/contracts";

export type TransactionTypeFilter = "BUY" | "SELL";

/** Two calendar days, `YYYY-MM-DD`, both included. */
export interface DateRange {
  from: string;
  to: string;
}

/**
 * What the filters panel holds. The type is a set because the Figma shows checkboxes, but the API
 * takes one `type`: with both checked, or none, every transaction matches and nothing is sent. The
 * asset is kept whole, not its id, because the chip that shows the filter needs its symbol.
 */
export interface TransactionFilters {
  types: readonly TransactionTypeFilter[];
  asset: AssetResponse | null;
  range: DateRange | null;
}

export const NO_FILTERS: TransactionFilters = { types: [], asset: null, range: null };

/** The filter part of the `listTransactions` query. */
export interface TransactionFilterQuery {
  type?: TransactionTypeFilter;
  assetId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const dayParts = (day: string) => {
  const [year = 0, month = 0, date = 0] = day.split("-").map(Number);
  return { year, monthIndex: month - 1, date };
};

/** The first instant of a calendar day, as the user's clock has it. */
const startOfDay = (day: string) => {
  const { year, monthIndex, date } = dayParts(day);
  return new Date(year, monthIndex, date, 0, 0, 0, 0);
};

/** The last instant of a calendar day: `dateTo` is inclusive, so the range must reach it. */
const endOfDay = (day: string) => {
  const { year, monthIndex, date } = dayParts(day);
  return new Date(year, monthIndex, date, 23, 59, 59, 999);
};

/** Whether the type narrows the list: one of the two is checked. */
const narrowsType = (types: readonly TransactionTypeFilter[]) => types.length === 1;

/** What to ask the API: only what narrows the list, so no filters is the request it always was. */
export function toFilterQuery({ types, asset, range }: TransactionFilters): TransactionFilterQuery {
  const [type] = types;
  return {
    ...(narrowsType(types) && type !== undefined ? { type } : {}),
    ...(asset ? { assetId: asset.id } : {}),
    ...(range
      ? {
          dateFrom: startOfDay(range.from).toISOString(),
          dateTo: endOfDay(range.to).toISOString(),
        }
      : {}),
  };
}

/**
 * Whether two sets of filters ask the API for the same transactions: no type and both types are
 * the same, and the asset counts by its id, not by the object that holds it.
 */
export function sameFilters(a: TransactionFilters, b: TransactionFilters): boolean {
  const type = ({ types }: TransactionFilters) => (narrowsType(types) ? types[0] : undefined);
  return (
    type(a) === type(b) &&
    a.asset?.id === b.asset?.id &&
    a.range?.from === b.range?.from &&
    a.range?.to === b.range?.to
  );
}

/** How many filters narrow the list, for "Filtros · 3". */
export function activeFilterCount({ types, asset, range }: TransactionFilters): number {
  return (narrowsType(types) ? 1 : 0) + (asset ? 1 : 0) + (range ? 1 : 0);
}

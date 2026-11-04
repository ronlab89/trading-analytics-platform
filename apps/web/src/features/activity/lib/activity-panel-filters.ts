import type { DateRange } from "@/features/transactions/lib/transaction-filters";
import type { ActivityFilters, ActivitySeverity, ActivitySource } from "./activity-events";

export const SEVERITIES: readonly ActivitySeverity[] = ["INFO", "SUCCESS", "WARNING", "ERROR"];
export const SOURCES: readonly ActivitySource[] = ["TRANSACTION", "ALERT"];

/**
 * What the Figma "Filtros" panel holds: the severities, the sources and the dates. The search is
 * not here, it sits in its own box. A group with every option checked asks for the same events as
 * one with none, so it narrows nothing.
 */
export interface ActivityPanelFilters {
  severities: readonly ActivitySeverity[];
  sources: readonly ActivitySource[];
  range: DateRange | null;
}

export const NO_PANEL_FILTERS: ActivityPanelFilters = { severities: [], sources: [], range: null };

/** The options that narrow the list: some, but not all, of the ones there are. */
function narrowing<T>(chosen: readonly T[], all: readonly T[]): readonly T[] {
  return chosen.length > 0 && chosen.length < all.length ? chosen : [];
}

/** How many groups narrow the list, for "Filtros · 3". */
export function activePanelFilterCount({
  severities,
  sources,
  range,
}: ActivityPanelFilters): number {
  return (
    (narrowing(severities, SEVERITIES).length > 0 ? 1 : 0) +
    (narrowing(sources, SOURCES).length > 0 ? 1 : 0) +
    (range ? 1 : 0)
  );
}

/** Whether two sets of filters ask for the same events, whatever the order they were checked in. */
export function samePanelFilters(a: ActivityPanelFilters, b: ActivityPanelFilters): boolean {
  const key = ({ severities, sources, range }: ActivityPanelFilters) =>
    JSON.stringify([
      [...narrowing(severities, SEVERITIES)].sort(),
      [...narrowing(sources, SOURCES)].sort(),
      range?.from ?? null,
      range?.to ?? null,
    ]);
  return key(a) === key(b);
}

/** The filters the model applies: what narrows, plus the search the page holds. */
export function toActivityFilters(
  { severities, sources, range }: ActivityPanelFilters,
  search: string,
): ActivityFilters {
  return {
    severities: narrowing(severities, SEVERITIES),
    sources: narrowing(sources, SOURCES),
    ...(range ? { dateFrom: range.from, dateTo: range.to } : {}),
    search,
  };
}

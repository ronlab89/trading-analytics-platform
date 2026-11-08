export type PageItem = number | "ellipsis";

/**
 * The page numbers the desktop pagination shows, as the Figma draws them (`1 2 3 … 10`): the first
 * and the last page, the current one with its neighbours, and an ellipsis where pages are left
 * out. Near either end it shows three pages, so the bar does not change width as you move. A gap
 * of a single page shows that page instead of an ellipsis, which would hide no more than the number.
 */
export function pageWindow(page: number, totalPages: number): PageItem[] {
  const shown = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 2) [2, 3].forEach((value) => shown.add(value));
  if (page >= totalPages - 1) [totalPages - 2, totalPages - 1].forEach((value) => shown.add(value));

  const pages = [...shown]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  return pages.flatMap<PageItem>((value, index) => {
    const previous = pages[index - 1];
    if (previous === undefined || value - previous === 1) return [value];
    return value - previous === 2 ? [value - 1, value] : ["ellipsis", value];
  });
}

/** Lower case without accents, so "educacion" finds "Educación". */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** The portfolios whose name contains the query, ignoring case, accents and the spaces around it. */
export function filterPortfolios<T extends { name: string }>(
  portfolios: readonly T[],
  query: string,
): T[] {
  const needle = fold(query.trim());
  return portfolios.filter(({ name }) => fold(name).includes(needle));
}

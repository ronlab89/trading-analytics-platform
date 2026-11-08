/** Query keys of the Analytics view, so a change to a portfolio can refresh all of its panels at once. */
export const analyticsKeys = {
  all: ["analytics"] as const,
  portfolio: (portfolioId: string) => [...analyticsKeys.all, portfolioId] as const,
};

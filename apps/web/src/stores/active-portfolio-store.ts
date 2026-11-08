import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ActivePortfolioState {
  /** What the user last chose; `resolveActivePortfolio` checks it against the real list. */
  selectedId: string | undefined;
  select: (id: string) => void;
  clear: () => void;
}

/**
 * Remembers the portfolio the user chose, across visits. It is only an id, never a secret
 * (ADR-005 point 4 forbids the access token there, not this), and it is never trusted:
 * a stale or foreign id falls back to the first active portfolio of the real list.
 */
export const useActivePortfolioStore = create<ActivePortfolioState>()(
  persist(
    (set) => ({
      selectedId: undefined,
      select: (id) => {
        set({ selectedId: id });
      },
      clear: () => {
        set({ selectedId: undefined });
      },
    }),
    {
      name: "trading.active-portfolio",
      partialize: ({ selectedId }) => ({ selectedId }),
    },
  ),
);

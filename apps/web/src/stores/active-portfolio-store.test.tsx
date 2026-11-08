import { beforeEach, describe, expect, it } from "vitest";
import { useActivePortfolioStore } from "./active-portfolio-store";

const STORAGE_KEY = "trading.active-portfolio";

describe("active portfolio store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useActivePortfolioStore.setState({ selectedId: undefined });
  });

  it("starts with nothing selected", () => {
    expect(useActivePortfolioStore.getState().selectedId).toBeUndefined();
  });

  it("remembers the selected portfolio id in localStorage", () => {
    useActivePortfolioStore.getState().select("p1");

    expect(useActivePortfolioStore.getState().selectedId).toBe("p1");
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject({
      state: { selectedId: "p1" },
    });
  });

  it("restores the selection saved by a previous visit", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { selectedId: "p2" }, version: 0 }),
    );

    await useActivePortfolioStore.persist.rehydrate();

    expect(useActivePortfolioStore.getState().selectedId).toBe("p2");
  });

  it("clears the selection", () => {
    useActivePortfolioStore.getState().select("p1");
    useActivePortfolioStore.getState().clear();

    expect(useActivePortfolioStore.getState().selectedId).toBeUndefined();
  });
});

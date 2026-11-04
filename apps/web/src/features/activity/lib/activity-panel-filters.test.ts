import { describe, expect, it } from "vitest";
import {
  activePanelFilterCount,
  NO_PANEL_FILTERS,
  samePanelFilters,
  toActivityFilters,
} from "./activity-panel-filters";

describe("activePanelFilterCount", () => {
  it("counts one for each group that narrows the list", () => {
    expect(activePanelFilterCount(NO_PANEL_FILTERS)).toBe(0);
    expect(
      activePanelFilterCount({
        severities: ["ERROR"],
        sources: ["ALERT"],
        range: { from: "2026-11-01", to: "2026-11-04" },
      }),
    ).toBe(3);
  });

  it("does not count a group with every option checked, because it narrows nothing", () => {
    expect(
      activePanelFilterCount({
        ...NO_PANEL_FILTERS,
        severities: ["INFO", "SUCCESS", "WARNING", "ERROR"],
        sources: ["TRANSACTION", "ALERT"],
      }),
    ).toBe(0);
  });
});

describe("samePanelFilters", () => {
  it("ignores the order of what is checked, and treats none and all as the same", () => {
    expect(
      samePanelFilters(
        { ...NO_PANEL_FILTERS, severities: ["ERROR", "WARNING"] },
        { ...NO_PANEL_FILTERS, severities: ["WARNING", "ERROR"] },
      ),
    ).toBe(true);
    expect(
      samePanelFilters(NO_PANEL_FILTERS, {
        ...NO_PANEL_FILTERS,
        sources: ["TRANSACTION", "ALERT"],
      }),
    ).toBe(true);
  });

  it("tells filters that ask for different events apart", () => {
    expect(samePanelFilters(NO_PANEL_FILTERS, { ...NO_PANEL_FILTERS, severities: ["ERROR"] })).toBe(
      false,
    );
    expect(
      samePanelFilters(
        { ...NO_PANEL_FILTERS, range: { from: "2026-11-01", to: "2026-11-04" } },
        { ...NO_PANEL_FILTERS, range: { from: "2026-11-01", to: "2026-11-03" } },
      ),
    ).toBe(false);
  });
});

describe("toActivityFilters", () => {
  it("keeps only what narrows, and adds the search the page holds", () => {
    expect(
      toActivityFilters(
        {
          severities: ["INFO", "SUCCESS", "WARNING", "ERROR"],
          sources: ["ALERT"],
          range: { from: "2026-11-01", to: "2026-11-04" },
        },
        "sync",
      ),
    ).toEqual({
      severities: [],
      sources: ["ALERT"],
      dateFrom: "2026-11-01",
      dateTo: "2026-11-04",
      search: "sync",
    });
  });

  it("leaves the dates out when there is no range", () => {
    expect(toActivityFilters(NO_PANEL_FILTERS, "")).toEqual({
      severities: [],
      sources: [],
      search: "",
    });
  });
});

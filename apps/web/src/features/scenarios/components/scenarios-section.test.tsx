import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { ScenarioRow } from "../types";
import { ScenariosSection } from "./scenarios-section";

const row: ScenarioRow = {
  id: "s1",
  name: "Apple falls",
  status: "SAVED",
  updatedAt: "2026-10-12T12:00:00.000Z",
  mainChange: { assetId: "a1", symbol: "AAPL", percentChange: -10 },
  otherChanges: 0,
  figures: null,
  figuresState: "loading",
};

function phone(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const noop = () => undefined;

describe("ScenariosSection", () => {
  it("holds its place while the scenarios load", () => {
    phone(false);
    render(<ScenariosSection isError={false} onNew={noop} onRetry={noop} rows={undefined} />);

    expect(screen.getByRole("status", { name: "Loading the scenarios" })).toBeInTheDocument();
  });

  it("lists the scenarios in a table", () => {
    phone(false);
    render(<ScenariosSection isError={false} onNew={noop} onRetry={noop} rows={[row]} />);

    expect(screen.getByRole("table", { name: "Scenarios" })).toBeInTheDocument();
  });

  it("lists the scenarios as cards on a phone", () => {
    phone(true);
    render(<ScenariosSection isError={false} onNew={noop} onRetry={noop} rows={[row]} />);

    expect(screen.getByRole("list", { name: "Scenarios" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("invites to create the first scenario when there are none", async () => {
    phone(false);
    const onNew = vi.fn();
    const user = userEvent.setup();
    render(<ScenariosSection isError={false} onNew={onNew} onRetry={noop} rows={[]} />);

    expect(screen.getByText("No scenarios yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New scenario" }));
    expect(onNew).toHaveBeenCalledOnce();
  });

  it("says that the scenarios could not be loaded and offers to try again", async () => {
    phone(false);
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ScenariosSection isError onNew={noop} onRetry={onRetry} rows={undefined} />);

    expect(screen.getByText("Could not load the scenarios")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { DEFAULT_ANALYTICS_PERIOD, type AnalyticsPeriod } from "../lib/analytics-period";
import { AnalyticsPeriodSelector } from "./analytics-period-selector";

const TODAY = new Date("2026-10-14T12:00:00Z");

function renderSelector(value: AnalyticsPeriod = DEFAULT_ANALYTICS_PERIOD) {
  const onChange = vi.fn();
  const view = render(<AnalyticsPeriodSelector onChange={onChange} today={TODAY} value={value} />);
  return { onChange, ...view };
}

describe("AnalyticsPeriodSelector", () => {
  it("offers the presets of the Figma and 'Custom', with no 1D", () => {
    renderSelector();

    for (const name of ["1W", "1M", "3M", "6M", "1Y", "Custom"]) {
      expect(screen.getByRole("button", { name })).toBeVisible();
    }
    expect(screen.queryByRole("button", { name: "1D" })).not.toBeInTheDocument();
  });

  it("presses the period in force and only that one", () => {
    renderSelector({ kind: "preset", period: "3M" });

    expect(screen.getByRole("button", { name: "3M" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1M" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "false");
  });

  it("asks for a preset when it is pressed", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelector();

    await user.click(screen.getByRole("button", { name: "6M" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ kind: "preset", period: "6M" });
  });

  it("presses 'Custom' once a range is in force", () => {
    renderSelector({ kind: "custom", from: "2026-10-01", to: "2026-10-14" });

    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1M" })).toHaveAttribute("aria-pressed", "false");
  });

  it("opens the calendar and applies a range of the presets as a custom period", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelector();

    await user.click(screen.getByRole("button", { name: "Custom" }));
    await user.click(await screen.findByRole("button", { name: "Last 7 days" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      kind: "custom",
      from: "2026-10-08",
      to: "2026-10-14",
    });
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("closes the calendar with 'Cancel' without changing the period", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelector();

    await user.click(screen.getByRole("button", { name: "Custom" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderSelector();

    expect(await axe(container)).toHaveNoViolations();
  });
});

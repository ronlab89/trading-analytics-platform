import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { DateRangeCalendar } from "./date-range-calendar";

const today = new Date(2026, 9, 14, 15, 30);

function setup(value: { from: string; to: string } | null = null) {
  const onApply = vi.fn();
  const onCancel = vi.fn();
  render(<DateRangeCalendar onApply={onApply} onCancel={onCancel} today={today} value={value} />);
  return { onApply, onCancel, user: userEvent.setup() };
}

const day = (name: RegExp) => screen.getByRole("button", { name });

describe("DateRangeCalendar", () => {
  it("offers the four presets and a custom range, and shows two months", () => {
    setup();

    for (const name of ["Last 7 days", "Last 30 days", "Last 90 days", "This year", "Custom"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("grid")).toHaveLength(2);
  });

  it("cannot be applied until both ends of the range are chosen", async () => {
    const { user } = setup();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();

    await user.click(day(/October 1st, 2026/));

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("applies the days picked one after the other", async () => {
    const { user, onApply } = setup({ from: "2026-10-01", to: "2026-10-14" });
    await user.click(screen.getByRole("button", { name: "Custom" }));

    await user.click(day(/October 5th, 2026/));
    await user.click(day(/October 9th, 2026/));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith({ from: "2026-10-05", to: "2026-10-09" });
  });

  it("chooses the range of a preset, writes it out and marks the preset", async () => {
    const { user, onApply } = setup();

    await user.click(screen.getByRole("button", { name: "Last 7 days" }));

    expect(screen.getByRole("button", { name: "Last 7 days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Oct 8, 2026 – Oct 14, 2026")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({ from: "2026-10-08", to: "2026-10-14" });
  });

  it("marks Custom for a range that is not a preset", () => {
    setup({ from: "2026-10-01", to: "2026-10-14" });

    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Last 7 days" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("closes without applying on Cancel", async () => {
    const { user, onApply, onCancel } = setup({ from: "2026-10-01", to: "2026-10-14" });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });
});

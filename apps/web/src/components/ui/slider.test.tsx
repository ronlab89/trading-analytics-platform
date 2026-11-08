import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Slider } from "./slider";

function renderSlider(overrides: Partial<Parameters<typeof Slider>[0]> = {}) {
  const onValueChange = vi.fn();
  const view = render(
    <Slider
      aria-label="Price of AAPL"
      max={10}
      min={-10}
      onValueChange={onValueChange}
      step={1}
      value={0}
      {...overrides}
    />,
  );
  return { onValueChange, view };
}

describe("Slider", () => {
  it("is a slider that says its value, its bounds and its name", () => {
    renderSlider({ value: -5 });

    const slider = screen.getByRole("slider", { name: "Price of AAPL" });
    expect(slider).toHaveAttribute("aria-valuenow", "-5");
    expect(slider).toHaveAttribute("aria-valuemin", "-10");
    expect(slider).toHaveAttribute("aria-valuemax", "10");
  });

  it("moves one step with the arrow keys and gives the new value as a number", async () => {
    const { onValueChange } = renderSlider({ value: 3 });

    screen.getByRole("slider").focus();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");

    // It is controlled: the value stays at 3 until the parent changes it, so each key counts from 3.
    expect(onValueChange.mock.calls).toEqual([[4], [2], [2]]);
  });

  it("goes to the ends with Home and End", async () => {
    const { onValueChange } = renderSlider();

    screen.getByRole("slider").focus();
    await userEvent.keyboard("{End}");
    await userEvent.keyboard("{Home}");

    expect(onValueChange.mock.calls).toEqual([[10], [-10]]);
  });

  it("draws a dot for each mark, where it belongs on the track", () => {
    const { view } = renderSlider({ marks: [-10, 0, 10] });

    const dots = view.container.querySelectorAll("[data-slot='slider-mark']");
    expect([...dots].map((dot) => (dot as HTMLElement).style.left)).toEqual(["0%", "50%", "100%"]);
  });

  it("does not move when it is disabled", async () => {
    const { onValueChange } = renderSlider({ disabled: true });

    screen.getByRole("slider").focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { view } = renderSlider({ marks: [-10, 0, 10] });

    expect(await axe(view.container)).toHaveNoViolations();
  });
});

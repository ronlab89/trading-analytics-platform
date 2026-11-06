import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "./progress";

const fill = () => screen.getByTestId("progress-fill");

describe("Progress", () => {
  it("is a progress bar with its label, range and value", () => {
    render(<Progress label="Import progress" max={200} value={50} />);

    const bar = screen.getByRole("progressbar", { name: "Import progress" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "200");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
  });

  it("fills in proportion to the value", () => {
    render(<Progress label="Import progress" max={200} value={50} />);

    expect(fill()).toHaveStyle({ width: "25%" });
  });

  it("is empty at zero and full at the maximum", () => {
    const { rerender } = render(<Progress label="Import progress" max={10} value={0} />);
    expect(fill()).toHaveStyle({ width: "0%" });

    rerender(<Progress label="Import progress" max={10} value={10} />);
    expect(fill()).toHaveStyle({ width: "100%" });
  });

  it("never draws outside the track when the value overshoots or the total is zero", () => {
    const { rerender } = render(<Progress label="Import progress" max={10} value={14} />);
    expect(fill()).toHaveStyle({ width: "100%" });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");

    rerender(<Progress label="Import progress" max={0} value={0} />);
    expect(fill()).toHaveStyle({ width: "0%" });
  });

  it("is indeterminate without a value: no aria-valuenow and a pulsing fill", () => {
    render(<Progress label="Import progress" max={10} value={null} />);

    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
    expect(fill()).toHaveClass("animate-pulse");
  });
});

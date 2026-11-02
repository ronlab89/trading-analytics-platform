import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { Field } from "@/components/ui/field";
import { DateField } from "./date-field";

function Harness({
  initial = "2026-10-14",
  onChange = () => undefined,
  error,
}: {
  initial?: string;
  onChange?: (day: string) => void;
  error?: string;
}) {
  const [day, setDay] = useState(initial);
  return (
    <Field error={error} label="Date" required>
      <DateField
        onChange={(next) => {
          setDay(next);
          onChange(next);
        }}
        value={day}
      />
    </Field>
  );
}

const input = () => screen.getByLabelText(/Date/);

describe("DateField", () => {
  it("is a date input that holds the day", () => {
    render(<Harness />);

    expect(input()).toHaveAttribute("type", "date");
    expect(input()).toHaveValue("2026-10-14");
  });

  it("draws the day in the design's format", () => {
    render(<Harness />);

    expect(screen.getByText("Oct 14, 2026")).toBeInTheDocument();
  });

  it("reports the day picked and draws it", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.change(input(), { target: { value: "2026-09-05" } });

    expect(onChange).toHaveBeenCalledWith("2026-09-05");
    expect(screen.getByText("Sep 5, 2026")).toBeInTheDocument();
  });

  it("draws nothing while the day is cleared", () => {
    render(<Harness initial="" />);

    expect(input()).toHaveValue("");
    expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
  });

  it("takes its invalid state from the Field", () => {
    render(<Harness error="Pick a day." />);

    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(input()).toHaveAccessibleDescription("Pick a day.");
  });
});

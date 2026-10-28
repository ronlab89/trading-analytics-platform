import { act, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { Toaster } from "./sonner";

describe("Toaster", () => {
  it("shows a toast with its title and description", async () => {
    render(<Toaster />);

    act(() => {
      toast.error("Could not sign out", { description: "Try again in a moment." });
    });

    expect(await screen.findByText("Could not sign out")).toBeVisible();
    expect(screen.getByText("Try again in a moment.")).toBeVisible();
  });

  it("announces its toasts politely, in a named region", () => {
    render(<Toaster />);

    const region = screen.getByRole("region", { name: /^Messages/ });

    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("has no accessibility violations with a toast open", async () => {
    const { container } = render(<Toaster />);

    act(() => {
      toast.error("Could not sign out", { description: "Try again in a moment." });
    });
    await screen.findByText("Could not sign out");

    expect(await axe(container)).toHaveNoViolations();
  });
});

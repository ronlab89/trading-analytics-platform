import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { PortfolioSelector, type PortfolioOption } from "./portfolio-selector";

const portfolios: readonly PortfolioOption[] = [
  { id: "growth", name: "Crecimiento", currency: "USD", initials: "CR" },
  { id: "conservative", name: "Conservador", currency: "USD", initials: "CO" },
];

describe("PortfolioSelector", () => {
  it("shows the selected portfolio and lets the user choose another", async () => {
    const onSelect = vi.fn();
    render(<PortfolioSelector onSelect={onSelect} portfolios={portfolios} selectedId="growth" />);

    await userEvent.click(screen.getByRole("button", { name: "Select portfolio" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Conservador" }));

    expect(onSelect).toHaveBeenCalledWith("conservative");
  });

  it("shows the Figma skeleton, announced as loading, while the portfolios load", async () => {
    const { container } = render(
      <PortfolioSelector loading onSelect={vi.fn()} portfolios={[]} selectedId={undefined} />,
    );

    expect(screen.getByRole("status", { name: "Loading portfolios" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows the disabled look with a plain label when there are no portfolios", async () => {
    const { container } = render(
      <PortfolioSelector onSelect={vi.fn()} portfolios={[]} selectedId={undefined} />,
    );

    const trigger = screen.getByRole("button", { name: "No portfolios" });
    expect(trigger).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows the disabled look when the selected id is not in the list", () => {
    render(<PortfolioSelector onSelect={vi.fn()} portfolios={portfolios} selectedId="gone" />);

    expect(screen.getByRole("button", { name: "No portfolios" })).toBeDisabled();
  });

  it("offers a retry when the portfolios failed to load", async () => {
    const onRetry = vi.fn();
    const { container } = render(
      <PortfolioSelector
        failed
        onRetry={onRetry}
        onSelect={vi.fn()}
        portfolios={[]}
        selectedId={undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Couldn't load portfolios. Retry" }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(await axe(container)).toHaveNoViolations();
  });
});

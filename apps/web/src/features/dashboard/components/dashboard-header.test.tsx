import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { DashboardHeader } from "./dashboard-header";

// Noon UTC: the same calendar day in every time zone a test machine is likely to run in.
const today = "2026-10-06T12:00:00.000Z";

describe("DashboardHeader", () => {
  it("says the day, the portfolio and how many positions it holds", () => {
    render(
      <DashboardHeader
        portfolioName="Growth"
        positionCount={5}
        today={today}
        updatedAt={Date.parse(today)}
      />,
    );

    expect(screen.getByText("Tuesday, October 6 · Growth · 5 positions")).toBeInTheDocument();
  });

  it("writes one position in the singular and none as zero", () => {
    const { rerender } = render(
      <DashboardHeader
        portfolioName="Growth"
        positionCount={1}
        today={today}
        updatedAt={Date.parse(today)}
      />,
    );
    expect(screen.getByText(/· 1 position$/)).toBeInTheDocument();

    rerender(
      <DashboardHeader
        portfolioName="Growth"
        positionCount={0}
        today={today}
        updatedAt={Date.parse(today)}
      />,
    );
    expect(screen.getByText(/· 0 positions$/)).toBeInTheDocument();
  });

  it("says when the data was last fetched", () => {
    render(
      <DashboardHeader
        portfolioName="Growth"
        positionCount={5}
        today={today}
        updatedAt={Date.parse("2026-10-06T14:32:07.000Z")}
      />,
    );

    expect(screen.getByText(/^Updated \d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it("shows the action it is given, at the end of the line", () => {
    render(
      <DashboardHeader
        action={<button type="button">New transaction</button>}
        portfolioName="Growth"
        positionCount={0}
        today={today}
        updatedAt={Date.parse(today)}
      />,
    );

    expect(screen.getByRole("button", { name: "New transaction" })).toBeInTheDocument();
  });
});

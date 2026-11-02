import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import "@/i18n";
import { DailyReturnsPanel } from "./daily-returns-panel";

const usd = (amount: string) => ({ amount, currency: "USD" });

function day(date: string, returnPercent: number | null) {
  return { date, value: usd("100000.00"), returnPercent };
}

function performance(status: "OK" | "INSUFFICIENT_DATA" = "OK") {
  return {
    asOf: "2026-10-06",
    effectiveFrom: "2026-09-07",
    status,
    twrPercent: 1,
    pnl: usd("1000.00"),
    series: [
      day("2026-10-01", null),
      day("2026-10-02", 1),
      day("2026-10-03", -2),
      day("2026-10-04", 3),
      day("2026-10-05", 1),
    ],
  };
}

function renderPanel(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  const Wrapper = tradingClientWrapper({ call });
  render(
    <Wrapper>
      <DailyReturnsPanel portfolioId="p1" />
    </Wrapper>,
  );
  return call;
}

describe("DailyReturnsPanel", () => {
  it("announces the loading while the first answer is on its way", () => {
    renderPanel(() => new Promise(() => undefined));

    expect(screen.getByRole("heading", { name: "Daily performance" })).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading the daily performance" }),
    ).toBeInTheDocument();
  });

  it("asks for three months of the portfolio", async () => {
    const call = renderPanel(() => Promise.resolve({ data: performance() }));
    await screen.findByRole("img", { name: /daily return/i });

    expect(call.mock.calls[0]?.[1]).toEqual({
      params: { portfolioId: "p1" },
      query: { period: "3M" },
    });
  });

  it("shows the five figures with their sign and the streak of days", async () => {
    renderPanel(() => Promise.resolve({ data: performance() }));
    await screen.findByRole("img", { name: /daily return/i });

    expect(screen.getByText("Best day").nextSibling).toHaveTextContent("+3.00%");
    expect(screen.getByText("Worst day").nextSibling).toHaveTextContent("-2.00%");
    expect(screen.getByText("Positive days").nextSibling).toHaveTextContent("75%");
    expect(screen.getByText("Daily average").nextSibling).toHaveTextContent("+0.75%");
    expect(screen.getByText("Current streak").nextSibling).toHaveTextContent("2 days up");
  });

  it("describes the bars in words for a screen reader", async () => {
    renderPanel(() => Promise.resolve({ data: performance() }));

    expect(
      await screen.findByText(
        "4 days from Oct 2 to Oct 5: 75% positive. Best day +3.00% on Oct 4, worst day -2.00% on Oct 3.",
      ),
    ).toBeInTheDocument();
  });

  it("says there is not enough data when the API has too little history", async () => {
    renderPanel(() => Promise.resolve({ data: performance("INSUFFICIENT_DATA") }));

    expect(await screen.findByText("Not enough data yet")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("fails on its own and tries again when asked", async () => {
    let failing = true;
    const call = renderPanel(() =>
      failing
        ? Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503))
        : Promise.resolve({ data: performance() }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load the daily performance",
    );

    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("img", { name: /daily return/i })).toBeInTheDocument();
    expect(call).toHaveBeenCalledTimes(2);
  });
});

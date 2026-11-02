import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import "@/i18n";
import { MonthlyReturns } from "./monthly-returns";

const usd = (amount: string) => ({ amount, currency: "USD" });

function day(date: string, returnPercent: number) {
  return { date, value: usd("100000.00"), returnPercent };
}

function performance(status: "OK" | "INSUFFICIENT_DATA" = "OK") {
  return {
    asOf: "2026-10-06",
    effectiveFrom: "2026-08-01",
    status,
    twrPercent: 1,
    pnl: usd("1000.00"),
    series: [
      day("2026-08-15", 10),
      day("2026-09-15", -5),
      day("2026-10-01", 2),
      day("2026-10-02", 2),
    ],
  };
}

function renderMonthly(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  const Wrapper = tradingClientWrapper({ call });
  render(
    <Wrapper>
      <MonthlyReturns portfolioId="p1" />
    </Wrapper>,
  );
  return call;
}

describe("MonthlyReturns", () => {
  it("announces the loading while the first answer is on its way", () => {
    renderMonthly(() => new Promise(() => undefined));

    expect(screen.getByRole("status", { name: "Loading the monthly performance" })).toBeVisible();
  });

  it("asks for six months of the portfolio", async () => {
    const call = renderMonthly(() => Promise.resolve({ data: performance() }));
    await screen.findByRole("list", { name: /last months/i });

    expect(call.mock.calls[0]?.[1]).toEqual({
      params: { portfolioId: "p1" },
      query: { period: "6M" },
    });
  });

  it("writes each month with its compounded return, signed, oldest first", async () => {
    renderMonthly(() => Promise.resolve({ data: performance() }));

    const items = within(await screen.findByRole("list", { name: /last months/i })).getAllByRole(
      "listitem",
    );

    expect(items.map((item) => item.textContent)).toEqual([
      "+10.00%Aug",
      "-5.00%Sep",
      "+4.04%Oct (current month)",
    ]);
  });

  it("shows nothing when the API has too little history", async () => {
    renderMonthly(() => Promise.resolve({ data: performance("INSUFFICIENT_DATA") }));

    await vi.waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("fails on its own and tries again when asked", async () => {
    let failing = true;
    const call = renderMonthly(() =>
      failing
        ? Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503))
        : Promise.resolve({ data: performance() }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load the monthly performance.",
    );

    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("list", { name: /last months/i })).toBeInTheDocument();
    expect(call).toHaveBeenCalledTimes(2);
  });
});

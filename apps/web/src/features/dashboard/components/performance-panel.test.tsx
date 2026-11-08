import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import "@/i18n";
import { PerformancePanel } from "./performance-panel";

const usd = (amount: string) => ({ amount, currency: "USD" });

function performance(status: "OK" | "INSUFFICIENT_DATA" = "OK") {
  return {
    asOf: "2026-10-06",
    effectiveFrom: "2026-09-07",
    status,
    twrPercent: 4,
    pnl: usd("5000.00"),
    series: [
      { date: "2026-09-07", value: usd("120000.00"), returnPercent: null },
      { date: "2026-09-08", value: usd("125000.00"), returnPercent: 4.1667 },
    ],
  };
}

function renderPanel(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  const Wrapper = tradingClientWrapper({ call });
  render(
    <Wrapper>
      <PerformancePanel portfolioId="p1" />
    </Wrapper>,
  );
  return call;
}

describe("PerformancePanel", () => {
  it("announces the loading while the first answer is on its way", () => {
    renderPanel(() => new Promise(() => undefined));

    expect(screen.getByRole("heading", { name: "Performance" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading the performance" })).toBeInTheDocument();
  });

  it("describes the chart in words for a screen reader", async () => {
    renderPanel(() => Promise.resolve({ data: performance() }));

    expect(await screen.findByRole("img", { name: /portfolio value/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        "From Sep 7 to Sep 8 the value went from $120,000.00 to $125,000.00 (+4.17%). High $125,000.00, low $120,000.00.",
      ),
    ).toBeInTheDocument();
  });

  it("asks for one month first and again for the period the user picks", async () => {
    const call = renderPanel(() => Promise.resolve({ data: performance() }));
    await screen.findByRole("img", { name: /portfolio value/i });
    expect(call.mock.calls[0]?.[1]).toMatchObject({ query: { period: "1M" } });
    expect(screen.getByRole("button", { name: "1M" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "3M" }));

    expect(screen.getByRole("button", { name: "3M" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1M" })).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => {
      expect(call.mock.calls[1]?.[1]).toMatchObject({ query: { period: "3M" } });
    });
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
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the performance");

    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("img", { name: /portfolio value/i })).toBeInTheDocument();
    expect(call).toHaveBeenCalledTimes(2);
  });
});

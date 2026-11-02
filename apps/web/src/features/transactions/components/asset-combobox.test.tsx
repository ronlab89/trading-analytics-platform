import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AssetResponse } from "@trading/contracts";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { AssetCombobox } from "./asset-combobox";

function asset(id: string, symbol: string, name: string): AssetResponse {
  return {
    id,
    symbol,
    name,
    assetType: "STOCK",
    currency: "USD",
    exchange: "NASDAQ",
    status: "ACTIVE",
    metadata: {},
  };
}

const apple = asset("a1", "AAPL", "Apple Inc.");
const microsoft = asset("a2", "MSFT", "Microsoft");

function clientWith(answer: (input?: CallInput) => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (_operation, input) => answer(input),
  );
  return { client: { call } as TradingClient, call };
}

const listing = (input?: CallInput) => {
  const term = input?.query?.search;
  if (term === "ms") return Promise.resolve({ data: [microsoft] });
  return Promise.resolve({ data: [apple, microsoft] });
};

function Harness({ onChange }: { onChange: (asset: AssetResponse) => void }) {
  const [value, setValue] = useState<AssetResponse | null>(null);
  return (
    <AssetCombobox
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      value={value}
    />
  );
}

function setup(answer: (input?: CallInput) => Promise<unknown> = listing) {
  const { client, call } = clientWith(answer);
  const onChange = vi.fn();
  const Wrapper = tradingClientWrapper(client);
  render(
    <Wrapper>
      <Harness onChange={onChange} />
    </Wrapper>,
  );
  return { call, onChange, user: userEvent.setup() };
}

describe("AssetCombobox", () => {
  it("shows the placeholder and asks for nothing while it is closed", () => {
    const { call } = setup();

    expect(screen.getByRole("combobox")).toHaveTextContent("Search an asset");
    expect(call).not.toHaveBeenCalled();
  });

  it("lists the assets when it opens", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: "AAPL · Apple Inc." })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "MSFT · Microsoft" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "true");
  });

  it("picks an asset with the mouse, closes, and shows it", async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole("combobox"));

    await user.click(await screen.findByRole("option", { name: "MSFT · Microsoft" }));

    expect(onChange).toHaveBeenCalledWith(microsoft);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("MSFT · Microsoft");
  });

  it("moves with the arrow keys and picks with Enter", async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole("combobox"));
    await screen.findByRole("option", { name: "AAPL · Apple Inc." });

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "MSFT · Microsoft" }).id,
    );

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(microsoft);
  });

  it("does not go past the first or the last option", async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole("combobox"));
    await screen.findByRole("option", { name: "AAPL · Apple Inc." });

    await user.keyboard("{ArrowUp}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}{Enter}");

    expect(onChange).toHaveBeenCalledWith(apple);
  });

  it("searches the API with what is typed, once the typing pauses", async () => {
    const { user, call } = setup();
    await user.click(screen.getByRole("combobox"));
    await screen.findByRole("option", { name: "AAPL · Apple Inc." });

    await user.type(screen.getByRole("textbox"), "ms");

    await waitFor(() => {
      expect(screen.queryByRole("option", { name: "AAPL · Apple Inc." })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("option", { name: "MSFT · Microsoft" })).toBeInTheDocument();
    const terms = call.mock.calls.map(([, input]) => input?.query?.search);
    expect(terms).toContain("ms");
    expect(terms).not.toContain("m");
  });

  it("says so when nothing matches", async () => {
    const { user } = setup(() => Promise.resolve({ data: [] }));

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByText("No assets match your search.")).toBeInTheDocument();
  });

  it("says so when the search fails", async () => {
    const { user } = setup(() => Promise.reject(new ApiError("INTERNAL_ERROR", "x", 500)));

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load assets");
  });

  it("closes with Escape without choosing", async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole("combobox"));
    await screen.findByRole("option", { name: "AAPL · Apple Inc." });

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

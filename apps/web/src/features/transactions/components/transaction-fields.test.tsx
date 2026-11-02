import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AssetResponse } from "@trading/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import {
  emptyTransactionForm,
  transactionFormSchema,
  type TransactionFormValues,
} from "../lib/transaction-form";
import { TransactionFields } from "./transaction-fields";

const apple: AssetResponse = {
  id: "a1",
  symbol: "AAPL",
  name: "Apple Inc.",
  assetType: "STOCK",
  currency: "USD",
  exchange: "NASDAQ",
  status: "ACTIVE",
  metadata: {},
};

const NOW = new Date(2026, 9, 14, 12);

function Harness({
  onValid = vi.fn(),
  held = 236,
  disabled = false,
}: {
  onValid?: (values: unknown) => void;
  held?: number | undefined;
  disabled?: boolean;
}) {
  const [asset, setAsset] = useState<AssetResponse | null>(null);
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: emptyTransactionForm(NOW),
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(onValid)(event);
      }}
    >
      <TransactionFields
        asset={asset}
        disabled={disabled}
        form={form}
        held={held}
        onAssetChange={setAsset}
      />
      <button type="submit">Send</button>
    </form>
  );
}

function setup(props: Parameters<typeof Harness>[0] = {}) {
  const client = {
    call: vi.fn(() => Promise.resolve({ data: [apple] })),
  } as unknown as TradingClient;
  const Wrapper = tradingClientWrapper(client);
  render(
    <Wrapper>
      <Harness {...props} />
    </Wrapper>,
  );
  return userEvent.setup();
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: /Type/ }));
  await user.click(screen.getByRole("option", { name: "Buy" }));
  await user.click(screen.getByRole("combobox", { name: /Asset/ }));
  await user.click(await screen.findByRole("option", { name: "AAPL · Apple Inc." }));
  await user.type(screen.getByRole("textbox", { name: /Quantity/ }), "10");
  await user.type(screen.getByRole("textbox", { name: /Price per unit/ }), "180.20");
  await user.type(screen.getByRole("textbox", { name: /Fees/ }), "1.00");
}

describe("TransactionFields", () => {
  it("asks for everything but the fees", () => {
    setup();

    expect(screen.getByRole("combobox", { name: /Type/ })).toBeRequired();
    expect(screen.getByRole("combobox", { name: /Asset/ })).toBeRequired();
    expect(screen.getByLabelText(/Date/)).toBeRequired();
    expect(screen.getByRole("textbox", { name: /Quantity/ })).toBeRequired();
    expect(screen.getByRole("textbox", { name: /Price per unit/ })).toBeRequired();
    expect(screen.getByRole("textbox", { name: /Fees/ })).not.toBeRequired();
  });

  it("starts empty, with today as the date, and says what empty fees mean", () => {
    setup();

    expect(screen.getByRole("combobox", { name: /Type/ })).toHaveTextContent("Select a type");
    expect(screen.getByRole("combobox", { name: /Asset/ })).toHaveTextContent("Search an asset");
    expect(screen.getByLabelText(/Date/)).toHaveValue("2026-10-14");
    expect(screen.getByRole("textbox", { name: /Fees/ })).toHaveAccessibleDescription(
      "If you leave it empty, it is taken as $0.00.",
    );
  });

  it("names what is missing when it is sent empty", async () => {
    const onValid = vi.fn();
    const user = setup({ onValid });

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Select a type.")).toBeInTheDocument();
    expect(screen.getByText("Select an asset.")).toBeInTheDocument();
    expect(screen.getByText("Enter a quantity greater than 0.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid price.")).toBeInTheDocument();
    expect(screen.queryByText("Enter a valid date.")).not.toBeInTheDocument();
    expect(onValid).not.toHaveBeenCalled();
  });

  it("flags invalid fees", async () => {
    const user = setup();

    await user.type(screen.getByRole("textbox", { name: /Fees/ }), "1,5");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Enter a valid fee.")).toBeInTheDocument();
  });

  it("sends the values once it is filled in, with the asset id", async () => {
    const onValid = vi.fn();
    const user = setup({ onValid });
    await fill(user);

    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(onValid).toHaveBeenCalled();
    });
    expect(onValid.mock.calls[0]?.[0]).toEqual({
      type: "BUY",
      assetId: "a1",
      executedAt: "2026-10-14",
      quantity: "10",
      price: "180.20",
      fees: "1.00",
    });
  });

  it("shows the impact summary once the asset, the quantity and the price are in", async () => {
    const user = setup();
    expect(screen.queryByRole("region", { name: "Impact summary" })).not.toBeInTheDocument();

    await fill(user);

    const summary = await screen.findByRole("region", { name: "Impact summary" });
    expect(summary).toHaveTextContent("$1,803.00");
    expect(summary).toHaveTextContent("236 to 246");
  });

  it("locks every field while it is disabled", () => {
    setup({ disabled: true });

    expect(screen.getByRole("combobox", { name: /Type/ })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Quantity/ })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Fees/ })).toBeDisabled();
  });
});

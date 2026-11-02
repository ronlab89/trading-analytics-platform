import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AssetResponse, PositionResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { NewTransactionPanel } from "./new-transaction-panel";

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

const held: PositionResponse = {
  id: "pos1",
  portfolioId: "p1",
  assetId: "a1",
  quantity: 236,
  averageEntryPrice: { amount: "150.00", currency: "USD" },
  currentPrice: { amount: "180.00", currency: "USD" },
  openedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const recorded = { transaction: { id: "t1" }, position: null };

function clientWith(create: (input?: CallInput) => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      switch (operation.operationId) {
        case "createTransaction":
          return create(input);
        case "listAssets":
          return Promise.resolve({ data: [apple] });
        case "listPositions":
          return Promise.resolve({ data: [held] });
        default:
          return Promise.resolve({ data: [] });
      }
    },
  );
  const createCalls = () =>
    call.mock.calls.filter(([op]) => op.operationId === "createTransaction");
  return { client: { call } as TradingClient, createCalls };
}

function setup(
  create: (input?: CallInput) => Promise<unknown> = () => Promise.resolve({ data: recorded }),
) {
  const { client, createCalls } = clientWith(create);
  const onOpenChange = vi.fn();
  const onRecorded = vi.fn();
  const Wrapper = tradingClientWrapper(client);
  render(
    <Wrapper>
      <NewTransactionPanel
        onOpenChange={onOpenChange}
        onRecorded={onRecorded}
        open
        portfolioId="p1"
      />
    </Wrapper>,
  );
  return { createCalls, onOpenChange, onRecorded, user: userEvent.setup() };
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

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Record transaction" }));

describe("NewTransactionPanel", () => {
  it("shows the Figma title, description and both actions", () => {
    setup();

    expect(screen.getByRole("dialog", { name: "New transaction" })).toBeInTheDocument();
    expect(screen.getByText("Record a purchase or a sale.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Record transaction" })).toBeEnabled();
  });

  it("is a sheet at the bottom of the screen on mobile", () => {
    setup();

    expect(screen.getByRole("dialog", { name: "New transaction" })).toHaveAttribute(
      "data-mobile-sheet",
    );
  });

  it("shows the position the transaction would leave, from what the portfolio holds", async () => {
    const { user } = setup();

    await fill(user);

    expect(await screen.findByRole("region", { name: "Impact summary" })).toHaveTextContent(
      "236 to 246",
    );
  });

  it("records the transaction, hands it over and closes", async () => {
    const { user, createCalls, onRecorded, onOpenChange } = setup();
    await fill(user);

    await submit(user);

    await waitFor(() => {
      expect(onRecorded).toHaveBeenCalledWith(
        recorded,
        expect.objectContaining({ symbol: "AAPL" }),
      );
    });
    const [, input] = createCalls()[0] ?? [];
    expect(input?.params).toEqual({ portfolioId: "p1" });
    expect(input?.body).toMatchObject({
      assetId: "a1",
      type: "BUY",
      quantity: 10,
      price: { amount: "180.20", currency: "USD" },
      fees: { amount: "1.00", currency: "USD" },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not send an incomplete form", async () => {
    const { user, createCalls } = setup();

    await submit(user);

    expect(await screen.findByText("Select a type.")).toBeInTheDocument();
    expect(createCalls()).toHaveLength(0);
  });

  it("locks the panel while it records", async () => {
    const { user, onOpenChange } = setup(() => new Promise(() => undefined));
    await fill(user);

    await submit(user);

    expect(await screen.findByRole("button", { name: "Recording…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Quantity/ })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps what was typed after a failure and tries again with the same key", async () => {
    const create = vi
      .fn<(input?: CallInput) => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("INTERNAL_ERROR", "x", 500))
      .mockResolvedValue({ data: recorded });
    const { user, onRecorded } = setup(create);
    await fill(user);

    await submit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The transaction could not be recorded",
    );
    expect(screen.getByRole("textbox", { name: /Quantity/ })).toHaveValue("10");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(onRecorded).toHaveBeenCalledWith(
        recorded,
        expect.objectContaining({ symbol: "AAPL" }),
      );
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]?.[0]?.idempotencyKey).toBe(
      create.mock.calls[0]?.[0]?.idempotencyKey,
    );
  });

  it("closes straight away when nothing was typed", async () => {
    const { user, onOpenChange } = setup();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog", { name: "Leave without saving?" })).not.toBeInTheDocument();
  });

  it("asks before leaving with something typed, and keeps the form if told to", async () => {
    const { user, onOpenChange } = setup();
    await user.type(screen.getByRole("textbox", { name: /Quantity/ }), "10");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      await screen.findByRole("dialog", { name: "Leave without saving?" }),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("dialog", { name: "Leave without saving?" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Quantity/ })).toHaveValue("10");
  });

  it("closes once leaving without saving is confirmed", async () => {
    const { user, onOpenChange } = setup();
    await user.type(screen.getByRole("textbox", { name: /Quantity/ }), "10");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(await screen.findByRole("button", { name: "Leave without saving" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

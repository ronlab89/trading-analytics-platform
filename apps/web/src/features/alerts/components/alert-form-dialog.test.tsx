import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AssetResponse } from "@trading/contracts";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import type { AlertRow } from "../lib/alert-row";
import { AlertFormDialog } from "./alert-form-dialog";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

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

const row: AlertRow = {
  id: "al1",
  assetId: "a1",
  symbol: "AAPL",
  name: "Apple Inc.",
  currency: "USD",
  condition: "ABOVE",
  threshold: 200,
  enabled: true,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-02T10:00:00.000Z",
};

const marketPrice = {
  assetId: "a1",
  price: { amount: "180.70", currency: "USD" },
  previousPrice: { amount: "177.00", currency: "USD" },
  change: { amount: "3.70", currency: "USD" },
  changePercent: 2.1,
  timestamp: "2026-11-03T14:32:07.000Z",
  source: "SIMULATED",
};

interface Answers {
  create?: () => Promise<unknown>;
  update?: () => Promise<unknown>;
}

function setup(
  props: Partial<Parameters<typeof AlertFormDialog>[0]> = {},
  { create, update }: Answers = {},
) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => {
      switch (operation.operationId) {
        case "createAlert":
          return create?.() ?? Promise.resolve({ data: { id: "new" } });
        case "updateAlert":
          return update?.() ?? Promise.resolve({ data: { id: "al1" } });
        case "listAssets":
          return Promise.resolve({ data: [apple] });
        case "getMarketPrices":
          return Promise.resolve({ data: [marketPrice] });
        default:
          return Promise.resolve({ data: [] });
      }
    },
  );
  const sent = (operationId: string) =>
    call.mock.calls.filter(([operation]) => operation.operationId === operationId);
  const onOpenChange = vi.fn();
  const Wrapper = tradingClientWrapper({ call });
  render(
    <Wrapper>
      <AlertFormDialog onOpenChange={onOpenChange} open {...props} />
    </Wrapper>,
  );
  return { sent, onOpenChange, user: userEvent.setup() };
}

const threshold = () => screen.getByRole("textbox", { name: /Threshold/ });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AlertFormDialog creating", () => {
  it("is a sheet on a phone, with the title and both actions", () => {
    setup();

    const dialog = screen.getByRole("dialog", { name: "Create alert" });
    expect(dialog).toHaveAttribute("data-mobile-sheet");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Create alert" })).toBeEnabled();
  });

  it("creates a price alert on the chosen asset, says so and closes", async () => {
    const { user, sent, onOpenChange } = setup();

    await user.click(screen.getByRole("combobox", { name: /Asset/ }));
    await user.click(await screen.findByRole("option", { name: "AAPL · Apple Inc." }));
    await user.click(screen.getByRole("combobox", { name: /Condition/ }));
    await user.click(screen.getByRole("option", { name: "Below" }));
    await user.type(threshold(), "150.5");
    await user.click(screen.getByRole("button", { name: "Create alert" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    const [, input] = sent("createAlert")[0] ?? [];
    expect(input?.body).toEqual({
      assetId: "a1",
      type: "PRICE",
      condition: "BELOW",
      threshold: 150.5,
      enabled: true,
    });
    expect(toast.success).toHaveBeenCalledWith("Alert created");
  });

  it("creates a paused alert when Enabled is cleared", async () => {
    const { user, sent } = setup({ asset: apple });

    await user.type(threshold(), "200");
    await user.click(screen.getByRole("checkbox", { name: "Enabled" }));
    await user.click(screen.getByRole("button", { name: "Create alert" }));

    await waitFor(() => {
      expect(sent("createAlert")).toHaveLength(1);
    });
    expect(sent("createAlert")[0]?.[1]?.body).toMatchObject({ enabled: false });
  });

  it("does not send an incomplete form, and says what is missing", async () => {
    const { user, sent } = setup();

    await user.click(screen.getByRole("button", { name: "Create alert" }));

    expect(await screen.findByText("Choose the asset to watch.")).toBeVisible();
    expect(screen.getByText("Enter a price greater than zero.")).toBeVisible();
    expect(sent("createAlert")).toHaveLength(0);
  });

  it("locks the asset it is given", () => {
    setup({ asset: apple });

    expect(screen.getByRole("textbox", { name: /Asset/ })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Asset/ })).toHaveValue("AAPL · Apple Inc.");
    expect(screen.queryByRole("combobox", { name: /Asset/ })).not.toBeInTheDocument();
  });

  it("creates the alert on the asset it is given", async () => {
    const { user, sent } = setup({ asset: apple });

    await user.type(threshold(), "200");
    await user.click(screen.getByRole("button", { name: "Create alert" }));

    await waitFor(() => {
      expect(sent("createAlert")).toHaveLength(1);
    });
    expect(sent("createAlert")[0]?.[1]?.body).toMatchObject({ assetId: "a1" });
  });
});

describe("AlertFormDialog price hint", () => {
  it("says where the price is and when the alert fires", async () => {
    const { user } = setup({ asset: apple });

    await user.type(threshold(), "200");

    expect(
      await screen.findByText("Now $180.70. It fires when the price goes above $200.00."),
    ).toBeVisible();
  });

  it("says when the condition is already true, so the alert waits for a new crossing", async () => {
    const { user } = setup({ asset: apple });

    await user.type(threshold(), "150");

    expect(
      await screen.findByText(
        "It is already above $150.00, so it will fire the next time the price crosses it again.",
      ),
    ).toBeVisible();
  });

  it("says nothing until there is a threshold", async () => {
    setup({ asset: apple });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /Asset/ })).toBeInTheDocument();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("AlertFormDialog failing", () => {
  it("shows the reason when the API refuses, and offers no retry", async () => {
    const { user } = setup(
      { asset: apple },
      {
        create: () =>
          Promise.reject(new ApiError("VALIDATION_ERROR", "Threshold is too high", 400)),
      },
    );
    await user.type(threshold(), "200");

    await user.click(screen.getByRole("button", { name: "Create alert" }));

    expect(await screen.findByText("Threshold is too high")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(threshold()).toHaveValue("200");
  });

  it("keeps what was typed and sends it again on retry after another failure", async () => {
    const create = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("INTERNAL_ERROR", "Server error", 500))
      .mockResolvedValue({ data: { id: "new" } });
    const { user, sent, onOpenChange } = setup({ asset: apple }, { create });
    await user.type(threshold(), "200");
    await user.click(screen.getByRole("button", { name: "Create alert" }));

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(sent("createAlert")).toHaveLength(2);
  });

  it("locks the dialog while it saves", async () => {
    const { user, onOpenChange } = setup(
      { asset: apple },
      { create: () => new Promise(() => undefined) },
    );
    await user.type(threshold(), "200");

    await user.click(screen.getByRole("button", { name: "Create alert" }));

    expect(await screen.findByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("AlertFormDialog editing", () => {
  it("opens with the alert, and its asset locked", () => {
    setup({ alert: row });

    expect(screen.getByRole("dialog", { name: "Edit alert" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Asset/ })).toHaveValue("AAPL · Apple Inc.");
    expect(screen.getByRole("textbox", { name: /Asset/ })).toBeDisabled();
    expect(threshold()).toHaveValue("200.00");
    expect(screen.getByRole("combobox", { name: /Condition/ })).toHaveTextContent("Above");
    expect(screen.getByRole("checkbox", { name: "Enabled" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("sends only what changed, to that alert, says so and closes", async () => {
    const { user, sent, onOpenChange } = setup({ alert: row });

    await user.clear(threshold());
    await user.type(threshold(), "250");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    const [, input] = sent("updateAlert")[0] ?? [];
    expect(input?.params).toEqual({ alertId: "al1" });
    expect(input?.body).toEqual({ threshold: 250 });
    expect(toast.success).toHaveBeenCalledWith("Alert updated");
  });

  it("closes without a request when nothing changed", async () => {
    const { user, sent, onOpenChange } = setup({ alert: row });

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(sent("updateAlert")).toHaveLength(0);
  });
});

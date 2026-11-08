import { render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { AssetAlertDialog } from "./asset-alert-dialog";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const apple = {
  id: "a1",
  symbol: "AAPL",
  name: "Apple Inc.",
  assetType: "STOCK",
  currency: "USD",
  exchange: "NASDAQ",
  status: "ACTIVE",
  metadata: {},
};

function setup(
  props: { assetId: string | null; open: boolean },
  getAsset: () => Promise<unknown> = () => Promise.resolve({ data: apple }),
) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) =>
      operation.operationId === "getAsset" ? getAsset() : Promise.resolve({ data: [] }),
  );
  const onOpenChange = vi.fn();
  render(<AssetAlertDialog onOpenChange={onOpenChange} {...props} />, {
    wrapper: tradingClientWrapper({ call }),
  });
  return { call, onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AssetAlertDialog", () => {
  it("opens the create dialog with the asset locked, once it is known", async () => {
    setup({ assetId: "a1", open: true });

    expect(await screen.findByRole("dialog", { name: "Create alert" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Asset/ })).toHaveValue("AAPL · Apple Inc.");
    expect(screen.getByRole("textbox", { name: /Asset/ })).toBeDisabled();
  });

  it("shows nothing while the asset loads", () => {
    setup({ assetId: "a1", open: true }, () => new Promise(() => undefined));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks for nothing while it is closed", () => {
    const { call } = setup({ assetId: "a1", open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
  });

  it("says so and gives up when the asset cannot be read", async () => {
    const { onOpenChange } = setup({ assetId: "a1", open: true }, () =>
      Promise.reject(new ApiError("INTERNAL_ERROR", "Server error", 500)),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not open the alert form");
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

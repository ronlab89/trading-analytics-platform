import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AlertResponse } from "@trading/contracts";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { AlertsTab } from "./alerts-tab";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

function alert(id: string, assetId: string, overrides: Partial<AlertResponse> = {}): AlertResponse {
  return {
    id,
    userId: "u1",
    assetId,
    portfolioId: null,
    type: "PRICE",
    condition: "ABOVE",
    threshold: 200,
    enabled: true,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
    ...overrides,
  };
}

const assets: Record<string, { symbol: string; name: string }> = {
  a1: { symbol: "AAPL", name: "Apple Inc." },
  a2: { symbol: "KO", name: "Coca-Cola" },
};

const asset = (id: string) => ({
  id,
  ...assets[id],
  assetType: "STOCK",
  currency: "USD",
  exchange: "NASDAQ",
  status: "ACTIVE",
  metadata: {},
});

interface Answers {
  update?: () => Promise<unknown>;
  remove?: () => Promise<unknown>;
}

function setup({ update, remove }: Answers = {}) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      switch (operation.operationId) {
        case "listAlerts":
          return Promise.resolve({
            data: [
              alert("al1", "a1"),
              alert("al2", "a2", {
                condition: "BELOW",
                threshold: 55,
                enabled: false,
                createdAt: "2026-10-01T10:00:00.000Z",
              }),
            ],
          });
        case "getAsset":
          return Promise.resolve({ data: asset(String(input?.params?.assetId)) });
        case "updateAlert":
          return update?.() ?? Promise.resolve({ data: alert("al1", "a1") });
        case "deleteAlert":
          return remove?.() ?? Promise.resolve({ data: undefined });
        default:
          return Promise.resolve({ data: [] });
      }
    },
  );
  const sent = (operationId: string) =>
    call.mock.calls.filter(([operation]) => operation.operationId === operationId);
  render(<AlertsTab />, { wrapper: tradingClientWrapper({ call }) });
  return { sent, user: userEvent.setup() };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole("button", { name: `Actions for ${name}` }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AlertsTab row menu", () => {
  it("offers Pause on an enabled alert and Resume on a paused one", async () => {
    const { user } = setup();

    await openMenu(user, "Apple Inc.");
    expect(screen.getByRole("menuitem", { name: "Pause" })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: "Resume" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await openMenu(user, "Coca-Cola");
    expect(screen.getByRole("menuitem", { name: "Resume" })).toBeVisible();
  });

  it("pauses an enabled alert at once, with no dialog, and says so", async () => {
    const { user, sent } = setup();
    await openMenu(user, "Apple Inc.");

    await user.click(screen.getByRole("menuitem", { name: "Pause" }));

    await waitFor(() => {
      expect(sent("updateAlert")).toHaveLength(1);
    });
    const [, input] = sent("updateAlert")[0] ?? [];
    expect(input?.params).toEqual({ alertId: "al1" });
    expect(input?.body).toEqual({ enabled: false });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Alert paused");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("resumes a paused alert and says so", async () => {
    const { user, sent } = setup();
    await openMenu(user, "Coca-Cola");

    await user.click(screen.getByRole("menuitem", { name: "Resume" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Alert resumed");
    });
    expect(sent("updateAlert")[0]?.[1]?.body).toEqual({ enabled: true });
  });

  it("says why when it cannot pause or resume", async () => {
    const { user } = setup({
      update: () => Promise.reject(new ApiError("NOT_FOUND", "Alert not found", 404)),
    });
    await openMenu(user, "Apple Inc.");

    await user.click(screen.getByRole("menuitem", { name: "Pause" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not change the alert", {
        description: "Alert not found",
      });
    });
  });

  it("opens the alert in the edit dialog", async () => {
    const { user } = setup();
    await openMenu(user, "Coca-Cola");

    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit alert" });
    expect(within(dialog).getByRole("textbox", { name: /Asset/ })).toHaveValue("KO · Coca-Cola");
    expect(within(dialog).getByRole("textbox", { name: /Threshold/ })).toHaveValue("55.00");
  });

  it("opens an empty create dialog after an edit one", async () => {
    const { user } = setup();
    await openMenu(user, "Coca-Cola");
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Create alert" }));

    expect(await screen.findByRole("dialog", { name: "Create alert" })).toBeVisible();
  });
});

describe("AlertsTab delete", () => {
  it("asks before deleting, and deleting nothing if the user cancels", async () => {
    const { user, sent } = setup();
    await openMenu(user, "Apple Inc.");

    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete this alert?" });
    expect(within(dialog).getByText("It stops notifying you.")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(sent("deleteAlert")).toHaveLength(0);
  });

  it("deletes the alert once confirmed, says so and closes", async () => {
    const { user, sent } = setup();
    await openMenu(user, "Apple Inc.");
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    await user.click(
      within(await screen.findByRole("dialog", { name: "Delete this alert?" })).getByRole(
        "button",
        { name: "Delete" },
      ),
    );

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Alert deleted");
    });
    expect(sent("deleteAlert")[0]?.[1]?.params).toEqual({ alertId: "al1" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("keeps the dialog open and says why when the API refuses", async () => {
    const { user } = setup({
      remove: () => Promise.reject(new ApiError("NOT_FOUND", "Alert not found", 404)),
    });
    await openMenu(user, "Apple Inc.");
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    await user.click(
      within(await screen.findByRole("dialog", { name: "Delete this alert?" })).getByRole(
        "button",
        { name: "Delete" },
      ),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not delete the alert", {
        description: "Alert not found",
      });
    });
    expect(screen.getByRole("dialog", { name: "Delete this alert?" })).toBeVisible();
  });
});

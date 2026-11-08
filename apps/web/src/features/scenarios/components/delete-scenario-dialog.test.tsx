import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import type { ScenarioRow } from "../types";
import { DeleteScenarioDialog } from "./delete-scenario-dialog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const scenario: ScenarioRow = {
  id: "s1",
  name: "Apple falls",
  status: "SAVED",
  updatedAt: "2026-10-12T12:00:00.000Z",
  mainChange: null,
  otherChanges: 0,
  figures: null,
  figuresState: "loading",
};

function clientWith(remove: () => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) =>
      operation.operationId === "deleteScenario" ? remove() : Promise.resolve({ data: [] }),
  );
  const deleteCalls = () => call.mock.calls.filter(([op]) => op.operationId === "deleteScenario");
  return { client: { call } as TradingClient, deleteCalls };
}

function renderDialog(
  client: TradingClient,
  { target = scenario, open = true }: { target?: ScenarioRow | null; open?: boolean } = {},
) {
  const onOpenChange = vi.fn();
  render(
    <DeleteScenarioDialog
      onOpenChange={onOpenChange}
      open={open}
      portfolioId="p1"
      scenario={target}
    />,
    { wrapper: tradingClientWrapper(client) },
  );
  return { onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteScenarioDialog", () => {
  it("asks to confirm, naming the scenario and saying the real portfolio is not touched", () => {
    renderDialog(clientWith(() => Promise.resolve(undefined)).client);

    expect(screen.getByRole("dialog", { name: "Delete scenario" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "“Apple falls” will be deleted. Your real portfolio is not changed. This cannot be undone.",
      ),
    ).toBeInTheDocument();
  });

  it("renders nothing while it is closed or has no scenario", () => {
    renderDialog(clientWith(() => Promise.resolve(undefined)).client, { open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Cancel without deleting anything", async () => {
    const { client, deleteCalls } = clientWith(() => Promise.resolve(undefined));
    const { onOpenChange } = renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(deleteCalls()).toHaveLength(0);
  });

  it("deletes the scenario, says so and closes", async () => {
    const { client, deleteCalls } = clientWith(() => Promise.resolve(undefined));
    const { onOpenChange } = renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Delete scenario" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(deleteCalls()[0]?.[1]).toEqual({ params: { portfolioId: "p1", scenarioId: "s1" } });
    expect(toast.success).toHaveBeenCalledWith("Scenario deleted", {
      description: "“Apple falls” was deleted.",
    });
  });

  it("locks the dialog while the API answers", async () => {
    const { client } = clientWith(() => new Promise(() => undefined));
    renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Delete scenario" }));

    expect(await screen.findByRole("button", { name: "Deleting…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("stays open and gives the reason when the API refuses", async () => {
    const { client } = clientWith(() =>
      Promise.reject(new ApiError("CONFLICT", "The scenario is in use.")),
    );
    const { onOpenChange } = renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Delete scenario" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not delete the scenario", {
        description: "The scenario is in use.",
      });
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the generic text when the failure says nothing about the request", async () => {
    const { client } = clientWith(() => Promise.reject(new ApiError("INTERNAL_ERROR", "boom")));
    renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Delete scenario" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not delete the scenario", {
        description: "There was a problem reaching the server. Try again in a moment.",
      });
    });
  });
});

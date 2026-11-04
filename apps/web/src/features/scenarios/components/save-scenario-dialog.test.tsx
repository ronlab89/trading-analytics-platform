import type { ScenarioResponse } from "@trading/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { SaveScenarioDialog } from "./save-scenario-dialog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const scenario: ScenarioResponse = {
  id: "s1",
  portfolioId: "p1",
  name: "Apple falls",
  description: null,
  baseSnapshotId: null,
  status: "DRAFT",
  changes: [{ assetId: "a1", percentChange: -10 }],
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-12T10:00:00.000Z",
};

function clientWith(update: (input?: CallInput) => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) =>
      operation.operationId === "updateScenario" ? update(input) : Promise.resolve({ data: [] }),
  );
  const updateCalls = () => call.mock.calls.filter(([op]) => op.operationId === "updateScenario");
  return { client: { call } as TradingClient, updateCalls };
}

const saved = (input?: CallInput) =>
  Promise.resolve({ data: { ...scenario, ...(input?.body as object), status: "SAVED" } });

function renderDialog(client: TradingClient, { open = true }: { open?: boolean } = {}) {
  const onOpenChange = vi.fn();
  const Wrapper = tradingClientWrapper(client);
  const view = render(
    <Wrapper>
      <SaveScenarioDialog
        onOpenChange={onOpenChange}
        open={open}
        portfolioId="p1"
        scenario={scenario}
      />
    </Wrapper>,
  );
  return { ...view, onOpenChange };
}

const nameBox = () => screen.getByRole("textbox", { name: /Name/ });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SaveScenarioDialog", () => {
  it("asks for a name, filled with the one the scenario has, and offers a description", () => {
    renderDialog(clientWith(saved).client);

    expect(screen.getByRole("dialog", { name: "Save scenario" })).toBeInTheDocument();
    expect(
      screen.getByText("Give it a name to find it later in your list of scenarios."),
    ).toBeInTheDocument();
    expect(nameBox()).toHaveValue("Apple falls");
    expect(screen.getByRole("textbox", { name: /Description/ })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save scenario" })).toBeEnabled();
  });

  it("renders nothing while it is closed", () => {
    renderDialog(clientWith(saved).client, { open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("saves the name and the description, marks the scenario as saved and closes with a toast", async () => {
    const { client, updateCalls } = clientWith(saved);
    const { onOpenChange } = renderDialog(client);
    await userEvent.clear(nameBox());
    await userEvent.type(nameBox(), "  Apple falls 10 % ");
    await userEvent.type(screen.getByRole("textbox", { name: /Description/ }), "Stress test");

    await userEvent.click(screen.getByRole("button", { name: "Save scenario" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(updateCalls()).toHaveLength(1);
    expect(updateCalls()[0]?.[1]).toMatchObject({
      params: { portfolioId: "p1", scenarioId: "s1" },
      body: { name: "Apple falls 10 %", description: "Stress test", status: "SAVED" },
    });
    expect(toast.success).toHaveBeenCalledWith("Scenario saved", {
      description: "“Apple falls 10 %” is in your list of scenarios.",
    });
  });

  it("does not send a description the user left empty", async () => {
    const { client, updateCalls } = clientWith(saved);
    renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Save scenario" }));

    await waitFor(() => {
      expect(updateCalls()).toHaveLength(1);
    });
    expect(updateCalls()[0]?.[1]?.body).toEqual({ name: "Apple falls", status: "SAVED" });
  });

  it("says the name is required and sends nothing while it is blank", async () => {
    const { client, updateCalls } = clientWith(saved);
    const { onOpenChange } = renderDialog(client);
    await userEvent.clear(nameBox());
    await userEvent.type(nameBox(), "   ");

    await userEvent.click(screen.getByRole("button", { name: "Save scenario" }));

    expect(await screen.findByText("Give the scenario a name.")).toBeInTheDocument();
    expect(nameBox()).toBeInvalid();
    expect(updateCalls()).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and says why when the API refuses", async () => {
    const { client } = clientWith(() =>
      Promise.reject(new ApiError("CONFLICT", "The scenario is archived.", 409)),
    );
    const { onOpenChange } = renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Save scenario" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not save the scenario", {
        description: "The scenario is archived.",
      });
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(nameBox()).toHaveValue("Apple falls");
  });

  it("has no accessibility violations", async () => {
    renderDialog(clientWith(saved).client);

    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { CompareScenariosDialog } from "./compare-scenarios-dialog";

const scenario = (id: string, name: string, status = "SAVED") => ({
  id,
  portfolioId: "p1",
  name,
  description: null,
  baseSnapshotId: null,
  status,
  changes: [],
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-12T10:00:00.000Z",
});

const seven = [
  scenario("s1", "Apple falls"),
  scenario("s2", "Microsoft rallies", "DRAFT"),
  scenario("s3", "Oil spikes"),
  scenario("s4", "Rates up"),
  scenario("s5", "Rates down"),
  scenario("s6", "Dollar weakens"),
  scenario("s7", "Old idea", "ARCHIVED"),
];

function clientWith(list: () => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) =>
      operation.operationId === "listScenarios" ? list() : Promise.reject(new Error("unexpected")),
  );
  return { client: { call } as TradingClient, call };
}

function renderDialog(
  client: TradingClient,
  { selected = [], open = true }: { selected?: readonly string[]; open?: boolean } = {},
) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  const Wrapper = tradingClientWrapper(client);
  const view = render(
    <Wrapper>
      <CompareScenariosDialog
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        open={open}
        portfolioId="p1"
        selected={selected}
      />
    </Wrapper>,
  );
  return { ...view, onOpenChange, onConfirm };
}

const box = (name: string) => screen.findByRole("checkbox", { name });
const confirm = () => screen.getByRole("button", { name: "Compare" });

describe("CompareScenariosDialog", () => {
  it("asks for two to five scenarios and lists the ones that are not archived, with their state", async () => {
    renderDialog(clientWith(() => Promise.resolve({ data: seven })).client);

    expect(await screen.findByRole("dialog", { name: "Compare scenarios" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Pick 2 to 5 scenarios. They get the letters A, B… in the order you pick them.",
      ),
    ).toBeInTheDocument();
    expect(await box("Apple falls")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(screen.queryByRole("checkbox", { name: "Old idea" })).not.toBeInTheDocument();
    expect(await box("Microsoft rallies")).toHaveAccessibleDescription("Draft");
    expect(await box("Apple falls")).toHaveAccessibleDescription("Saved");
  });

  it("starts from the scenarios that were already being compared", async () => {
    renderDialog(clientWith(() => Promise.resolve({ data: seven })).client, {
      selected: ["s2", "s1"],
    });

    expect(await box("Apple falls")).toBeChecked();
    expect(await box("Microsoft rallies")).toBeChecked();
    expect(await box("Oil spikes")).not.toBeChecked();
    expect(screen.getByText("2 of 5 selected")).toBeInTheDocument();
  });

  it("cannot compare fewer than two, and says so", async () => {
    renderDialog(clientWith(() => Promise.resolve({ data: seven })).client);
    await userEvent.click(await box("Apple falls"));

    expect(confirm()).toBeDisabled();
    expect(screen.getByText("Pick at least 2 scenarios.")).toBeInTheDocument();

    await userEvent.click(await box("Oil spikes"));

    expect(confirm()).toBeEnabled();
    expect(screen.queryByText("Pick at least 2 scenarios.")).not.toBeInTheDocument();
  });

  it("gives the ids in the order they were picked, not the order of the list", async () => {
    const { onConfirm } = renderDialog(clientWith(() => Promise.resolve({ data: seven })).client);

    await userEvent.click(await box("Oil spikes"));
    await userEvent.click(await box("Apple falls"));
    await userEvent.click(await box("Microsoft rallies"));
    await userEvent.click(confirm());

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(["s3", "s1", "s2"]);
  });

  it("takes a scenario out of the order when it is unchecked and the next one goes last", async () => {
    const { onConfirm } = renderDialog(clientWith(() => Promise.resolve({ data: seven })).client);

    await userEvent.click(await box("Apple falls"));
    await userEvent.click(await box("Oil spikes"));
    await userEvent.click(await box("Apple falls"));
    await userEvent.click(await box("Rates up"));
    await userEvent.click(confirm());

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(["s3", "s4"]);
  });

  it("stops at five: the others are locked until one is unchecked, and it says why", async () => {
    renderDialog(clientWith(() => Promise.resolve({ data: seven })).client, {
      selected: ["s1", "s2", "s3", "s4", "s5"],
    });

    expect(await box("Dollar weakens")).toBeDisabled();
    expect(await box("Apple falls")).toBeEnabled();
    expect(screen.getByText("5 of 5 selected")).toBeInTheDocument();
    expect(screen.getByText("You can compare up to 5 scenarios.")).toBeInTheDocument();

    await userEvent.click(await box("Apple falls"));

    expect(await box("Dollar weakens")).toBeEnabled();
    expect(screen.queryByText("You can compare up to 5 scenarios.")).not.toBeInTheDocument();
  });

  it("closes without giving anything on Cancel", async () => {
    const { onConfirm, onOpenChange } = renderDialog(
      clientWith(() => Promise.resolve({ data: seven })).client,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("starts again from what was being compared each time it opens", async () => {
    const { client } = clientWith(() => Promise.resolve({ data: seven }));
    const { rerender, onConfirm, onOpenChange } = renderDialog(client, { selected: ["s1", "s2"] });
    await userEvent.click(await box("Oil spikes"));

    const Wrapper = tradingClientWrapper(client);
    const ui = (open: boolean) => (
      <Wrapper>
        <CompareScenariosDialog
          onConfirm={onConfirm}
          onOpenChange={onOpenChange}
          open={open}
          portfolioId="p1"
          selected={["s1", "s2"]}
        />
      </Wrapper>
    );
    rerender(ui(false));
    rerender(ui(true));

    expect(await box("Oil spikes")).not.toBeChecked();
    expect(await box("Apple falls")).toBeChecked();
  });

  it("holds the place of the list while it loads", () => {
    renderDialog(clientWith(() => new Promise(() => undefined)).client);

    expect(screen.getByRole("status", { name: "Loading the scenarios" })).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
  });

  it("says it could not load the scenarios and asks again on retry", async () => {
    const list = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("NETWORK_ERROR", "offline"))
      .mockResolvedValue({ data: seven });
    renderDialog(clientWith(list).client);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the scenarios");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await box("Apple falls")).toBeInTheDocument();
  });

  it("says there are not enough scenarios to compare when there are fewer than two", async () => {
    renderDialog(clientWith(() => Promise.resolve({ data: [seven[0], seven[6]] })).client);

    expect(
      await screen.findByText(
        "You need at least 2 scenarios to compare. Create another one first.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(confirm()).toBeDisabled();
  });

  it("renders nothing while it is closed", () => {
    renderDialog(clientWith(() => Promise.resolve({ data: seven })).client, { open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    renderDialog(clientWith(() => Promise.resolve({ data: seven })).client);
    await box("Apple falls");

    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
  });
});

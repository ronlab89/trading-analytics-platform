import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { CompareScenariosButton } from "./compare-scenarios-button";

const scenario = (id: string, name: string) => ({
  id,
  portfolioId: "p1",
  name,
  description: null,
  baseSnapshotId: null,
  status: "SAVED",
  changes: [],
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-12T10:00:00.000Z",
});

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{`${pathname}${search}`}</output>;
}

function renderButton() {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    () =>
      Promise.resolve({
        data: [scenario("s1", "Apple falls"), scenario("s2", "Microsoft rallies")],
      }),
  );
  const Wrapper = tradingClientWrapper({ call });
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={["/decisions?tab=lab"]}>
        <CompareScenariosButton portfolioId="p1" />
        <Where />
      </MemoryRouter>
    </Wrapper>,
  );
}

describe("CompareScenariosButton", () => {
  it("opens the picker with nothing chosen", async () => {
    renderButton();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Compare" }));

    const dialog = await screen.findByRole("dialog", { name: "Compare scenarios" });
    expect(await within(dialog).findByRole("checkbox", { name: "Apple falls" })).not.toBeChecked();
  });

  it("goes to the comparison of the scenarios picked, in the order they were picked", async () => {
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Compare" }));
    const dialog = await screen.findByRole("dialog", { name: "Compare scenarios" });
    await userEvent.click(
      await within(dialog).findByRole("checkbox", { name: "Microsoft rallies" }),
    );
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Apple falls" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Compare" }));

    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent("/decisions/lab/compare?ids=s2%2Cs1");
    });
  });
});

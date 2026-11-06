import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { ImportCsvDialog } from "./import-csv-dialog";

const GOOD = "symbol,type,quantity,price,executedAt\nAAPL,BUY,10,150,2026-01-05\n";
const queued = {
  id: "j1",
  portfolioId: "p1",
  status: "QUEUED",
  stage: "QUEUED",
  failureReason: null,
  progress: { processed: 0, total: 0 },
};

function setup(importAnswer: () => Promise<unknown> = () => Promise.resolve({ data: queued })) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) =>
      operation.operationId === "importTransactions"
        ? importAnswer()
        : Promise.resolve({ data: queued }),
  );
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const Wrapper = tradingClientWrapper({ call });
  const view = (open: boolean) => (
    <Wrapper>
      <ImportCsvDialog onOpenChange={onOpenChange} open={open} portfolioId="p1" />
    </Wrapper>
  );
  const { rerender } = render(view(true));
  const user = userEvent.setup();
  const choose = async () => {
    await user.upload(
      screen.getByLabelText("choose a file"),
      new File([GOOD], "trades.csv", { type: "text/csv" }),
    );
    await screen.findByText("trades.csv · 1 row");
  };
  return {
    call,
    onOpenChange,
    user,
    choose,
    reopen: () => {
      rerender(view(true));
    },
  };
}

describe("ImportCsvDialog", () => {
  it("starts at the step to choose a file", () => {
    setup();

    expect(screen.getByRole("heading", { name: "Import transactions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("goes on to follow the job once the API queued it", async () => {
    const { user, choose } = setup();
    await choose();

    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByRole("progressbar", { name: "Import progress" })).toBeInTheDocument();
    expect(await screen.findByText("Queued")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import" })).not.toBeInTheDocument();
  });

  it("cannot be dismissed while the file is being sent", async () => {
    const { user, choose, onOpenChange } = setup(() => new Promise(() => undefined));
    await choose();

    await user.click(screen.getByRole("button", { name: "Import" }));
    await user.keyboard("{Escape}");

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("can be dismissed once the job is queued, and asks its owner to close", async () => {
    const { user, choose, onOpenChange } = setup();
    await choose();
    await user.click(screen.getByRole("button", { name: "Import" }));
    await screen.findByText("Queued");

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("starts from the first step again after it was closed", async () => {
    const { user, choose, onOpenChange, reopen } = setup();
    await choose();
    await user.click(screen.getByRole("button", { name: "Import" }));
    await screen.findByText("Queued");
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);

    reopen();

    expect(await screen.findByRole("button", { name: "Import" })).toBeDisabled();
  });
});

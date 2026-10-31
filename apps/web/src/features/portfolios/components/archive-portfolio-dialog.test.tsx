import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PortfolioResponse } from "@trading/contracts";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { ArchivePortfolioDialog } from "./archive-portfolio-dialog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const portfolio: PortfolioResponse = {
  id: "p1",
  userId: "u1",
  name: "Conservative",
  description: null,
  baseCurrency: "USD",
  status: "ACTIVE",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function clientWith(archive: () => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) =>
      operation.operationId === "archivePortfolio" ? archive() : Promise.resolve({ data: [] }),
  );
  const archiveCalls = () =>
    call.mock.calls.filter(([op]) => op.operationId === "archivePortfolio");
  return { client: { call } as TradingClient, archiveCalls };
}

const archiveOk = () =>
  Promise.resolve({
    data: { ...portfolio, status: "ARCHIVED" },
    meta: { alreadyArchived: false },
  });

function renderDialog(
  client: TradingClient,
  { target = portfolio, open = true }: { target?: PortfolioResponse | null; open?: boolean } = {},
) {
  const onOpenChange = vi.fn();
  render(<ArchivePortfolioDialog onOpenChange={onOpenChange} open={open} portfolio={target} />, {
    wrapper: tradingClientWrapper(client),
  });
  return { onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ArchivePortfolioDialog", () => {
  it("asks to confirm, naming the portfolio and warning that it cannot be undone", () => {
    renderDialog(clientWith(archiveOk).client);

    expect(screen.getByRole("dialog", { name: "Archive portfolio?" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "“Conservative” will stop being active and you won’t be able to edit it. This can’t be undone.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled();
  });

  it("renders nothing while it is closed or has no portfolio", () => {
    const { client } = clientWith(archiveOk);
    renderDialog(client, { open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing without a portfolio", () => {
    renderDialog(clientWith(archiveOk).client, { target: null });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("archives that portfolio, then closes with the Figma notice", async () => {
    const { client, archiveCalls } = clientWith(archiveOk);
    const { onOpenChange } = renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(archiveCalls()).toHaveLength(1);
    expect(archiveCalls()[0]?.[1]).toEqual({ params: { portfolioId: "p1" } });
    expect(toast.success).toHaveBeenCalledWith("Portfolio archived", {
      description: "“Conservative” moved to archived.",
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("closes from Cancel without archiving anything", async () => {
    const { client, archiveCalls } = clientWith(archiveOk);
    const { onOpenChange } = renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(archiveCalls()).toHaveLength(0);
  });

  it("locks the dialog while archiving", async () => {
    const { client } = clientWith(() => new Promise(() => undefined));
    const { onOpenChange } = renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));

    const confirm = await screen.findByRole("button", { name: "Archiving…" });
    expect(confirm).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("stays open and announces a failed archive, so the user can try again", async () => {
    const { client } = clientWith(() =>
      Promise.reject(new ApiError("NETWORK_ERROR", "Network down")),
    );
    const { onOpenChange } = renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Couldn't archive the portfolio", {
        description: "Check your connection and try again. Nothing was changed.",
      });
    });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    renderDialog(clientWith(archiveOk).client);

    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
  });
});

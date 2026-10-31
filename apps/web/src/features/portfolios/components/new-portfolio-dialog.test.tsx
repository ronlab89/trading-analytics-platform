import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PortfolioResponse } from "@trading/contracts";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { NewPortfolioDialog } from "./new-portfolio-dialog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const created: PortfolioResponse = {
  id: "p9",
  userId: "u1",
  name: "Fixed income",
  description: null,
  baseCurrency: "USD",
  status: "ACTIVE",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function clientWith(create: () => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) =>
      operation.operationId === "createPortfolio" ? create() : Promise.resolve({ data: [] }),
  );
  const createCalls = () => call.mock.calls.filter(([op]) => op.operationId === "createPortfolio");
  return { client: { call } as TradingClient, createCalls };
}

function renderDialog(client: TradingClient, onOpenChange = vi.fn(), open = true) {
  const Wrapper = tradingClientWrapper(client);
  const ui = (isOpen: boolean) => (
    <Wrapper>
      <NewPortfolioDialog onOpenChange={onOpenChange} open={isOpen} />
    </Wrapper>
  );
  const view = render(ui(open));
  const setOpen = (isOpen: boolean) => {
    view.rerender(ui(isOpen));
  };
  return { ...view, onOpenChange, setOpen };
}

async function fillAndPick(name: string, currency = "USD · US dollar") {
  await userEvent.type(screen.getByRole("textbox", { name: /Name/ }), name);
  await userEvent.click(screen.getByRole("combobox", { name: /Base currency/ }));
  await userEvent.click(screen.getByRole("option", { name: currency }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NewPortfolioDialog", () => {
  it("shows the Figma title, description, fields and both actions", () => {
    renderDialog(clientWith(() => Promise.resolve({ data: created })).client);

    expect(screen.getByRole("dialog", { name: "New portfolio" })).toBeInTheDocument();
    expect(
      screen.getByText("Group your positions and transactions in an independent portfolio."),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Description/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Base currency/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Create portfolio" })).toBeEnabled();
  });

  it("is a sheet at the bottom of the screen on mobile, as the Figma form is", () => {
    renderDialog(clientWith(() => Promise.resolve({ data: created })).client);

    expect(screen.getByRole("dialog", { name: "New portfolio" })).toHaveAttribute(
      "data-mobile-sheet",
    );
  });

  it("renders nothing while it is closed", () => {
    renderDialog(clientWith(() => Promise.resolve({ data: created })).client, vi.fn(), false);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("creates the portfolio with the trimmed name, the description and the currency", async () => {
    const { client, createCalls } = clientWith(() => Promise.resolve({ data: created }));
    renderDialog(client);
    await userEvent.type(screen.getByRole("textbox", { name: /Name/ }), "  Fixed income ");
    await userEvent.type(screen.getByRole("textbox", { name: /Description/ }), "Stable income");
    await userEvent.click(screen.getByRole("combobox", { name: /Base currency/ }));
    await userEvent.click(screen.getByRole("option", { name: "EUR · Euro" }));

    await userEvent.click(screen.getByRole("button", { name: "Create portfolio" }));

    await waitFor(() => {
      expect(createCalls()).toHaveLength(1);
    });
    expect(createCalls()[0]?.[1]?.body).toEqual({
      name: "Fixed income",
      description: "Stable income",
      baseCurrency: "EUR",
    });
  });

  it("leaves a blank description out of the request", async () => {
    const { client, createCalls } = clientWith(() => Promise.resolve({ data: created }));
    renderDialog(client);
    await fillAndPick("Fixed income");

    await userEvent.click(screen.getByRole("button", { name: "Create portfolio" }));

    await waitFor(() => {
      expect(createCalls()).toHaveLength(1);
    });
    expect(createCalls()[0]?.[1]?.body).toEqual({ name: "Fixed income", baseCurrency: "USD" });
  });

  it("explains what is missing and sends nothing when the form is empty", async () => {
    const { client, createCalls } = clientWith(() => Promise.resolve({ data: created }));
    const { onOpenChange } = renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Create portfolio" }));

    expect(await screen.findByText("Enter a name")).toBeInTheDocument();
    expect(screen.getByText("Select a base currency.")).toBeInTheDocument();
    expect(createCalls()).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("locks the dialog while the portfolio is being created", async () => {
    const { client } = clientWith(() => new Promise(() => undefined));
    const { onOpenChange } = renderDialog(client);
    await fillAndPick("Fixed income");

    await userEvent.click(screen.getByRole("button", { name: "Create portfolio" }));

    const submit = await screen.findByRole("button", { name: "Creating…" });
    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("textbox", { name: /Name/ })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Description/ })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /Base currency/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes with a toast naming the portfolio once it is created", async () => {
    const { client } = clientWith(() => Promise.resolve({ data: created }));
    const { onOpenChange } = renderDialog(client);
    await fillAndPick("Fixed income");

    await userEvent.click(screen.getByRole("button", { name: "Create portfolio" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(toast.success).toHaveBeenCalledWith("Portfolio created", {
      description: "“Fixed income” is now in your list.",
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("stays open with what the user typed and announces a failed creation", async () => {
    const { client } = clientWith(() =>
      Promise.reject(new ApiError("NETWORK_ERROR", "Network down")),
    );
    const { onOpenChange } = renderDialog(client);
    await fillAndPick("Fixed income");

    await userEvent.click(screen.getByRole("button", { name: "Create portfolio" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Couldn't create the portfolio", {
        description: "Check your connection and try again. Nothing was created.",
      });
    });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: /Name/ })).toHaveValue("Fixed income");
    expect(screen.getByRole("textbox", { name: /Name/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Create portfolio" })).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("closes from Cancel without creating anything", async () => {
    const { client, createCalls } = clientWith(() => Promise.resolve({ data: created }));
    const { onOpenChange } = renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(createCalls()).toHaveLength(0);
  });

  it("opens empty again after it was closed with text typed", async () => {
    const { client } = clientWith(() => Promise.resolve({ data: created }));
    const { setOpen } = renderDialog(client);
    await userEvent.type(screen.getByRole("textbox", { name: /Name/ }), "Leftover");

    setOpen(false);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    setOpen(true);

    expect(await screen.findByRole("textbox", { name: /Name/ })).toHaveValue("");
  });

  describe("leaving with unsaved changes", () => {
    const leave = {
      Cancel: () => userEvent.click(screen.getByRole("button", { name: "Cancel" })),
      "the close button": () => userEvent.click(screen.getByRole("button", { name: "Close" })),
      Escape: () => userEvent.keyboard("{Escape}"),
    };

    it.each(Object.entries(leave))(
      "asks before %s discards what the user typed",
      async (_way, attempt) => {
        const { client, createCalls } = clientWith(() => Promise.resolve({ data: created }));
        const { onOpenChange } = renderDialog(client);
        await userEvent.type(screen.getByRole("textbox", { name: /Name/ }), "Fixed income");

        await attempt();

        const confirm = await screen.findByRole("dialog", { name: "Leave without saving?" });
        expect(
          within(confirm).getByText(
            "The portfolio you’re creating will be discarded. This can’t be undone.",
          ),
        ).toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(createCalls()).toHaveLength(0);
      },
    );

    it("goes back to the form, with what was typed, on “Keep editing”", async () => {
      const { onOpenChange } = renderDialog(
        clientWith(() => Promise.resolve({ data: created })).client,
      );
      await userEvent.type(screen.getByRole("textbox", { name: /Name/ }), "Fixed income");
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      await userEvent.click(await screen.findByRole("button", { name: "Keep editing" }));

      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: "Leave without saving?" }),
        ).not.toBeInTheDocument();
      });
      expect(screen.getByRole("textbox", { name: /Name/ })).toHaveValue("Fixed income");
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("closes the dialog on “Leave without saving”, creating nothing", async () => {
      const { client, createCalls } = clientWith(() => Promise.resolve({ data: created }));
      const { onOpenChange } = renderDialog(client);
      await userEvent.type(screen.getByRole("textbox", { name: /Name/ }), "Fixed income");
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      await userEvent.click(await screen.findByRole("button", { name: "Leave without saving" }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(createCalls()).toHaveLength(0);
    });

    it("closes straight away once the user has emptied what they typed", async () => {
      const { onOpenChange } = renderDialog(
        clientWith(() => Promise.resolve({ data: created })).client,
      );
      const name = screen.getByRole("textbox", { name: /Name/ });
      await userEvent.type(name, "Fixed income");
      await userEvent.clear(name);

      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(
        screen.queryByRole("dialog", { name: "Leave without saving?" }),
      ).not.toBeInTheDocument();
    });

    it("does not carry the unsaved state over to the next time it opens", async () => {
      const { setOpen, onOpenChange } = renderDialog(
        clientWith(() => Promise.resolve({ data: created })).client,
      );
      await userEvent.type(screen.getByRole("textbox", { name: /Name/ }), "Leftover");
      setOpen(false);
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      setOpen(true);

      await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("has no accessibility violations", async () => {
      renderDialog(clientWith(() => Promise.resolve({ data: created })).client);
      await userEvent.type(screen.getByRole("textbox", { name: /Name/ }), "Fixed income");
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(
        await axe(await screen.findByRole("dialog", { name: "Leave without saving?" })),
      ).toHaveNoViolations();
    });
  });

  it("has no accessibility violations", async () => {
    renderDialog(clientWith(() => Promise.resolve({ data: created })).client);

    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PortfolioResponse } from "@trading/contracts";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { EditPortfolioDialog } from "./edit-portfolio-dialog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const portfolio: PortfolioResponse = {
  id: "p1",
  userId: "u1",
  name: "Growth",
  description: "Medium term",
  baseCurrency: "EUR",
  status: "ACTIVE",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function clientWith(update: () => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) =>
      operation.operationId === "updatePortfolio" ? update() : Promise.resolve({ data: [] }),
  );
  const updateCalls = () => call.mock.calls.filter(([op]) => op.operationId === "updatePortfolio");
  return { client: { call } as TradingClient, updateCalls };
}

const saved = () => Promise.resolve({ data: { ...portfolio, name: "Global growth" } });

function renderDialog(
  client: TradingClient,
  { target = portfolio, open = true }: { target?: PortfolioResponse | null; open?: boolean } = {},
) {
  const onOpenChange = vi.fn();
  const Wrapper = tradingClientWrapper(client);
  const ui = (isOpen: boolean, current: PortfolioResponse | null) => (
    <Wrapper>
      <EditPortfolioDialog onOpenChange={onOpenChange} open={isOpen} portfolio={current} />
    </Wrapper>
  );
  const view = render(ui(open, target));
  const reopen = (isOpen: boolean, current: PortfolioResponse | null = target) => {
    view.rerender(ui(isOpen, current));
  };
  return { ...view, onOpenChange, reopen };
}

const nameBox = () => screen.getByRole("textbox", { name: /Name/ });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditPortfolioDialog", () => {
  it("shows the Figma title, description and both actions, filled with the portfolio", () => {
    renderDialog(clientWith(saved).client);

    expect(screen.getByRole("dialog", { name: "Edit portfolio" })).toBeInTheDocument();
    expect(screen.getByText("Change the name of your portfolio.")).toBeInTheDocument();
    expect(nameBox()).toHaveValue("Growth");
    expect(screen.getByRole("textbox", { name: /Description/ })).toHaveValue("Medium term");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("is a sheet at the bottom of the screen on mobile, as the Figma form is", () => {
    renderDialog(clientWith(saved).client);

    expect(screen.getByRole("dialog", { name: "Edit portfolio" })).toHaveAttribute(
      "data-mobile-sheet",
    );
  });

  it("uses the description the Figma gives the mobile form", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      media: query,
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    renderDialog(clientWith(saved).client);

    expect(screen.getByRole("dialog", { name: "Edit portfolio" })).toBeInTheDocument();
    expect(screen.getByText("Change the name or the description.")).toBeInTheDocument();
    expect(screen.queryByText("Change the name of your portfolio.")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("shows the base currency locked, with the reason", () => {
    renderDialog(clientWith(saved).client);

    const currency = screen.getByRole("combobox", { name: /Base currency/ });
    expect(currency).toBeDisabled();
    expect(currency).toHaveTextContent("EUR · Euro");
    expect(currency).toHaveAccessibleDescription("The base currency can’t be changed.");
  });

  it("renders nothing while it is closed or has no portfolio", () => {
    const { client } = clientWith(saved);
    const closed = renderDialog(client, { open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    closed.unmount();

    renderDialog(client, { target: null });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sends only what changed and closes with a toast naming the portfolio", async () => {
    const { client, updateCalls } = clientWith(saved);
    const { onOpenChange } = renderDialog(client);
    await userEvent.clear(nameBox());
    await userEvent.type(nameBox(), "  Global growth ");

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(updateCalls()[0]?.[1]).toEqual({
      params: { portfolioId: "p1" },
      body: { name: "Global growth" },
    });
    expect(toast.success).toHaveBeenCalledWith("Portfolio updated", {
      description: "“Global growth” was saved.",
    });
  });

  it("clears the description by sending an empty text", async () => {
    const { client, updateCalls } = clientWith(saved);
    renderDialog(client);
    await userEvent.clear(screen.getByRole("textbox", { name: /Description/ }));

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateCalls()).toHaveLength(1);
    });
    expect(updateCalls()[0]?.[1]?.body).toEqual({ description: "" });
  });

  it("closes without any request or toast when nothing changed", async () => {
    const { client, updateCalls } = clientWith(saved);
    const { onOpenChange } = renderDialog(client);

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(updateCalls()).toHaveLength(0);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("explains a missing name and sends nothing", async () => {
    const { client, updateCalls } = clientWith(saved);
    renderDialog(client);
    await userEvent.clear(nameBox());

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Enter a name")).toBeInTheDocument();
    expect(updateCalls()).toHaveLength(0);
  });

  it("locks the dialog while saving", async () => {
    const { client } = clientWith(() => new Promise(() => undefined));
    const { onOpenChange } = renderDialog(client);
    await userEvent.type(nameBox(), " plus");

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const submit = await screen.findByRole("button", { name: "Saving…" });
    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(nameBox()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("stays open with what the user typed and announces a failed save", async () => {
    const { client } = clientWith(() =>
      Promise.reject(new ApiError("NETWORK_ERROR", "Network down")),
    );
    const { onOpenChange } = renderDialog(client);
    await userEvent.type(nameBox(), " plus");

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Couldn't save the portfolio", {
        description: "Check your connection and try again. Nothing was changed.",
      });
    });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(nameBox()).toHaveValue("Growth plus");
    expect(nameBox()).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("closes from Cancel straight away when nothing changed", async () => {
    const { onOpenChange } = renderDialog(clientWith(saved).client);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog", { name: "Leave without saving?" })).not.toBeInTheDocument();
  });

  it("starts from the portfolio again every time it opens", async () => {
    const { reopen } = renderDialog(clientWith(saved).client);
    await userEvent.type(nameBox(), " leftover");

    reopen(false);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    reopen(true);

    expect(await screen.findByRole("textbox", { name: /Name/ })).toHaveValue("Growth");
  });

  describe("leaving with unsaved changes", () => {
    const leave = {
      Cancel: () => userEvent.click(screen.getByRole("button", { name: "Cancel" })),
      "the close button": () => userEvent.click(screen.getByRole("button", { name: "Close" })),
      Escape: () => userEvent.keyboard("{Escape}"),
    };

    it.each(Object.entries(leave))(
      "asks before %s discards the changes, with the edit wording",
      async (_way, attempt) => {
        const { client, updateCalls } = clientWith(saved);
        const { onOpenChange } = renderDialog(client);
        await userEvent.type(nameBox(), " plus");

        await attempt();

        const confirm = await screen.findByRole("dialog", { name: "Leave without saving?" });
        expect(
          within(confirm).getByText(
            "The changes you made to this portfolio will be lost. This can’t be undone.",
          ),
        ).toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(updateCalls()).toHaveLength(0);
      },
    );

    it("goes back to the form on “Keep editing” and closes on “Leave without saving”", async () => {
      const { onOpenChange } = renderDialog(clientWith(saved).client);
      await userEvent.type(nameBox(), " plus");
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      await userEvent.click(await screen.findByRole("button", { name: "Keep editing" }));
      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: "Leave without saving?" }),
        ).not.toBeInTheDocument();
      });
      expect(nameBox()).toHaveValue("Growth plus");
      expect(onOpenChange).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await userEvent.click(await screen.findByRole("button", { name: "Leave without saving" }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("has no accessibility violations", async () => {
    renderDialog(clientWith(saved).client);

    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
  });
});

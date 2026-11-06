import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput } from "@/api/trading-client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { importTemplate } from "../lib/import-template";
import { ImportChooseStep } from "./import-choose-step";

const download = vi.hoisted(() => vi.fn<(name: string, text: string) => void>());
vi.mock("@/lib/download-text-file", () => ({ downloadTextFile: download }));

const GOOD =
  "symbol,type,quantity,price,executedAt\nAAPL,BUY,10,150,2026-01-05\nAAPL,SELL,2,160,2026-01-06\n";
const job = { id: "j1", status: "QUEUED", stage: "QUEUED" };

const csv = (text: string, name = "trades.csv") => new File([text], name, { type: "text/csv" });

function setup(answer: () => Promise<unknown> = () => Promise.resolve({ data: job })) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    () => answer(),
  );
  const onQueued = vi.fn();
  const Wrapper = tradingClientWrapper({ call });
  render(
    <Wrapper>
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <ImportChooseStep onQueued={onQueued} portfolioId="p1" />
        </DialogContent>
      </Dialog>
    </Wrapper>,
  );
  const user = userEvent.setup();
  const upload = (file: File) => user.upload(screen.getByLabelText("choose a file"), file);
  const submit = () => screen.getByRole("button", { name: "Import" });
  return { call, onQueued, user, upload, submit };
}

beforeEach(() => {
  download.mockClear();
});

describe("ImportChooseStep", () => {
  it("asks for a file and keeps Import disabled until there is a good one", () => {
    const { submit } = setup();

    expect(screen.getByRole("heading", { name: "Import transactions" })).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });

  it("shows the name and the row count of a good file and enables Import", async () => {
    const { upload, submit } = setup();

    await upload(csv(GOOD));

    expect(await screen.findByText("trades.csv · 2 rows")).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it("tells what is wrong with a file before anything is sent, and keeps Import disabled", async () => {
    const { upload, submit, call } = setup();

    await upload(csv("symbol,type\nAAPL,BUY\n"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The header is missing: quantity, price, executedAt.",
    );
    expect(submit()).toBeDisabled();
    expect(call).not.toHaveBeenCalled();
  });

  it("tells about columns the API does not know", async () => {
    const { upload } = setup();

    await upload(csv("symbol,type,quantity,price,executedAt,note\nAAPL,BUY,1,1,2026-01-01,x\n"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The header has unknown columns: note.",
    );
  });

  it("tells about an empty file", async () => {
    const { upload } = setup();

    await upload(csv(""));

    expect(await screen.findByRole("alert")).toHaveTextContent("The file has no rows to import.");
  });

  it("sends the CSV to the portfolio and hands over the queued job", async () => {
    const { upload, submit, user, call, onQueued } = setup();
    await upload(csv(GOOD));
    await screen.findByText("trades.csv · 2 rows");

    await user.click(submit());

    await waitFor(() => {
      expect(onQueued).toHaveBeenCalledWith(job);
    });
    expect(call.mock.calls[0]?.[0].operationId).toBe("importTransactions");
    expect(call.mock.calls[0]?.[1]?.params).toEqual({ portfolioId: "p1" });
    expect(call.mock.calls[0]?.[1]?.body).toBe(GOOD);
  });

  it("locks Cancel and the file while the API has not answered", async () => {
    const { upload, submit, user } = setup(() => new Promise(() => undefined));
    await upload(csv(GOOD));
    await screen.findByText("trades.csv · 2 rows");

    await user.click(submit());

    expect(await screen.findByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByLabelText("choose a file")).toBeDisabled();
  });

  it("shows the reason of a refusal and offers no retry for it", async () => {
    const { upload, submit, user } = setup(() =>
      Promise.reject(new ApiError("CONFLICT", "The portfolio is archived.", 409)),
    );
    await upload(csv(GOOD));
    await screen.findByText("trades.csv · 2 rows");

    await user.click(submit());

    expect(await screen.findByText("The portfolio is archived.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("offers a retry for any other failure and keeps the chosen file", async () => {
    const answers = [
      () => Promise.reject(new ApiError("TIMEOUT", "Timed out")),
      () => Promise.resolve({ data: job }),
    ];
    const { upload, submit, user, onQueued } = setup(
      () => answers.shift()?.() ?? Promise.resolve(),
    );
    await upload(csv(GOOD));
    await screen.findByText("trades.csv · 2 rows");

    await user.click(submit());
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(onQueued).toHaveBeenCalledWith(job);
    });
  });

  it("downloads the template", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Download the template" }));

    expect(download).toHaveBeenCalledWith("transactions-template.csv", importTemplate());
  });
});

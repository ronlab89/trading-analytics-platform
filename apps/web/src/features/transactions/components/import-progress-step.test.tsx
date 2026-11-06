import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput } from "@/api/trading-client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { ImportProgressStep } from "./import-progress-step";

const job = (patch: Record<string, unknown> = {}) => ({
  id: "j1",
  portfolioId: "p1",
  status: "PROCESSING",
  stage: "VALIDATING",
  failureReason: null,
  progress: { processed: 40, total: 100 },
  ...patch,
});

interface Answers {
  get?: () => Promise<unknown>;
  cancel?: () => Promise<unknown>;
  retry?: () => Promise<unknown>;
}

function setup(first: Record<string, unknown>, { get, cancel, retry }: Answers = {}) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => {
      switch (operation.operationId) {
        case "cancelJob":
          return cancel?.() ?? Promise.resolve({ data: job({ status: "CANCELLED" }) });
        case "retryJob":
          return retry?.() ?? Promise.resolve({ data: job({ status: "QUEUED", stage: "QUEUED" }) });
        default:
          return get?.() ?? Promise.resolve({ data: first });
      }
    },
  );
  const Wrapper = tradingClientWrapper({ call });
  render(
    <Wrapper>
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <ImportProgressStep jobId="j1" />
        </DialogContent>
      </Dialog>
    </Wrapper>,
  );
  return { call, user: userEvent.setup() };
}

describe("ImportProgressStep", () => {
  it("shows the stage, the count and the bar of a job that is running", async () => {
    setup(job());

    expect(await screen.findByText("Validating")).toBeInTheDocument();
    expect(screen.getByText("40 of 100 rows")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Import progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("You can close this window. The import keeps running.")).toBeVisible();
  });

  it("names the Applying stage and offers no Cancel once rows are being applied", async () => {
    setup(job({ stage: "APPLYING" }));

    expect(await screen.findByText("Applying")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel import" })).not.toBeInTheDocument();
  });

  it("shows a bar with no value while the total is not known yet", async () => {
    setup(job({ status: "QUEUED", stage: "QUEUED", progress: { processed: 0, total: 0 } }));

    expect(await screen.findByText("Queued")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Import progress" })).not.toHaveAttribute(
      "aria-valuenow",
    );
  });

  it("cancels a job that is validating and shows it cancelled", async () => {
    const { call, user } = setup(job());

    await user.click(await screen.findByRole("button", { name: "Cancel import" }));

    expect(await screen.findByText("The import was cancelled.")).toBeInTheDocument();
    expect(call.mock.calls.some(([operation]) => operation.operationId === "cancelJob")).toBe(true);
    expect(screen.queryByRole("button", { name: "Cancel import" })).not.toBeInTheDocument();
  });

  it("offers to retry a cancelled job and queues it again", async () => {
    const { call, user } = setup(job({ status: "CANCELLED" }));

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Queued")).toBeInTheDocument();
    expect(call.mock.calls.some(([operation]) => operation.operationId === "retryJob")).toBe(true);
  });

  it("says a completed job finished, with nothing to cancel or retry", async () => {
    setup(
      job({ status: "COMPLETED", stage: "APPLYING", progress: { processed: 100, total: 100 } }),
    );

    expect(await screen.findByText("The import finished.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel import" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.queryByText("You can close this window. The import keeps running.")).toBeNull();
  });

  it("explains a failure by its reason, and offers a retry only when it can help", async () => {
    setup(job({ status: "FAILED", failureReason: "INTERRUPTED" }));

    expect(
      await screen.findByText("The import was interrupted. You can try it again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("offers no retry for a file that failed validation", async () => {
    setup(job({ status: "FAILED", failureReason: "VALIDATION_FAILED" }));

    expect(
      await screen.findByText("The file has rows that cannot be imported."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("says when the import took too long", async () => {
    setup(job({ status: "TIMED_OUT" }));

    expect(
      await screen.findByText("The import took too long and stopped. You can try it again."),
    ).toBeInTheDocument();
  });

  it("shows the reason of a refused cancel and keeps the job as it was", async () => {
    const { user } = setup(job(), {
      cancel: () =>
        Promise.reject(new ApiError("CONFLICT", "The job can no longer be cancelled.", 409)),
    });

    await user.click(await screen.findByRole("button", { name: "Cancel import" }));

    expect(await screen.findByText("The job can no longer be cancelled.")).toBeInTheDocument();
    expect(screen.getByText("Validating")).toBeInTheDocument();
  });

  it("tells when the job cannot be read at all", async () => {
    setup(job(), { get: () => Promise.reject(new ApiError("NOT_FOUND", "No such job.", 404)) });

    expect(
      await screen.findByText("The import could not be read. Check your connection."),
    ).toBeInTheDocument();
  });
});

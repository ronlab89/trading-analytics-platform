import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useImportCsv } from "./use-import-csv";

const csv = "symbol,type,quantity,price,executedAt\nAAPL,BUY,10,150,2026-01-05\n";
const job = { id: "j1", portfolioId: "p1", type: "IMPORT_TRANSACTIONS", status: "QUEUED" };

function clientWith(importCsv: (input?: CallInput) => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (_operation, input) => importCsv(input),
  );
  const inputs = () => call.mock.calls.map(([, input]) => input);
  return { client: { call } as TradingClient, call, inputs };
}

const render = (client: TradingClient) =>
  renderHook(() => useImportCsv("p1"), { wrapper: tradingClientWrapper(client) });

describe("useImportCsv", () => {
  it("sends the CSV as the body to the portfolio's import, with an Idempotency-Key", async () => {
    const { client, call, inputs } = clientWith(() => Promise.resolve({ data: job }));
    const { result } = render(client);

    await act(() => result.current.mutateAsync(csv));

    expect(call.mock.calls[0]?.[0].operationId).toBe("importTransactions");
    expect(inputs()[0]?.params).toEqual({ portfolioId: "p1" });
    expect(inputs()[0]?.body).toBe(csv);
    expect(inputs()[0]?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns the job that was queued", async () => {
    const { client } = clientWith(() => Promise.resolve({ data: job }));
    const { result } = render(client);

    await expect(result.current.mutateAsync(csv)).resolves.toEqual(job);
  });

  it("keeps the key when the same file is sent again after a failure", async () => {
    const importCsv = vi
      .fn<(input?: CallInput) => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("TIMEOUT", "Timed out"))
      .mockResolvedValue({ data: job });
    const { client, inputs } = clientWith(importCsv);
    const { result } = render(client);

    await act(() => result.current.mutateAsync(csv).catch(() => undefined));
    await act(() => result.current.mutateAsync(csv));

    const [first, second] = inputs().map((input) => input?.idempotencyKey);
    expect(second).toBe(first);
  });

  it("uses a new key when the file changes", async () => {
    const importCsv = vi
      .fn<(input?: CallInput) => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("TIMEOUT", "Timed out"))
      .mockResolvedValue({ data: job });
    const { client, inputs } = clientWith(importCsv);
    const { result } = render(client);

    await act(() => result.current.mutateAsync(csv).catch(() => undefined));
    await act(() => result.current.mutateAsync(`${csv}AAPL,SELL,1,160,2026-01-06\n`));

    const [first, second] = inputs().map((input) => input?.idempotencyKey);
    expect(second).not.toBe(first);
  });

  it("uses a new key for the next import once one was queued", async () => {
    const { client, inputs } = clientWith(() => Promise.resolve({ data: job }));
    const { result } = render(client);

    await act(() => result.current.mutateAsync(csv));
    await act(() => result.current.mutateAsync(csv));

    const [first, second] = inputs().map((input) => input?.idempotencyKey);
    expect(second).not.toBe(first);
  });

  it("passes the API's refusal on, as the dialog shows it", async () => {
    const { client } = clientWith(() =>
      Promise.reject(new ApiError("VALIDATION_ERROR", "Too big", 413)),
    );
    const { result } = render(client);

    await act(() => result.current.mutateAsync(csv).catch(() => undefined));

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(ApiError);
    });
  });
});

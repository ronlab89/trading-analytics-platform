import { renderHook, waitFor } from "@testing-library/react";
import type { AlertResponse } from "@trading/contracts";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput } from "@/api/trading-client";
import { createQueryClient } from "@/lib/query-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useAlerts } from "./use-alerts";
import { useCreateAlert } from "./use-create-alert";
import { useDeleteAlert } from "./use-delete-alert";
import { useUpdateAlert } from "./use-update-alert";

function alert(id: string, enabled = true): AlertResponse {
  return {
    id,
    userId: "u1",
    assetId: "a1",
    portfolioId: null,
    type: "PRICE",
    condition: "ABOVE",
    threshold: 200,
    enabled,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
  };
}

/** The server holds `held`; every mutation answers with `answer` and the list reads `held`. */
function setup(answer: () => Promise<unknown> = () => Promise.resolve({ data: alert("a-new") })) {
  const held = [alert("al1"), alert("al2")];
  const call = vi.fn((operation: { operationId: string }, _input?: CallInput) =>
    operation.operationId === "listAlerts" ? Promise.resolve({ data: [...held] }) : answer(),
  );
  const view = renderHook(
    () => ({
      list: useAlerts(),
      create: useCreateAlert(),
      update: useUpdateAlert(),
      remove: useDeleteAlert(),
    }),
    { wrapper: tradingClientWrapper({ call }, createQueryClient()) },
  );
  const listReads = () =>
    call.mock.calls.filter(([operation]) => operation.operationId === "listAlerts").length;
  return { call, held, listReads, ...view };
}

describe("useAlerts", () => {
  it("lists the alerts of the user", async () => {
    const { result } = setup();

    await waitFor(() => {
      expect(result.current.list.data?.map(({ id }) => id)).toEqual(["al1", "al2"]);
    });
  });
});

describe("useCreateAlert", () => {
  it("sends the alert to the server and returns the one it created", async () => {
    const { call, result } = setup();
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });
    const body = { assetId: "a1", type: "PRICE", condition: "ABOVE", threshold: 200 } as const;

    let created: AlertResponse | undefined;
    await act(async () => {
      created = await result.current.create.mutateAsync(body);
    });

    expect(created?.id).toBe("a-new");
    expect(call).toHaveBeenCalledWith(expect.objectContaining({ operationId: "createAlert" }), {
      body,
    });
  });

  it("reads the list again once it is created", async () => {
    const { listReads, result } = setup();
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });
    const before = listReads();

    await act(async () => {
      await result.current.create.mutateAsync({
        assetId: "a1",
        type: "PRICE",
        condition: "BELOW",
        threshold: 150,
      });
    });

    await waitFor(() => {
      expect(listReads()).toBeGreaterThan(before);
    });
  });

  it("does not read the list again when the server refuses", async () => {
    const { listReads, result } = setup(() =>
      Promise.reject(new ApiError("VALIDATION_ERROR", "Refused", 400)),
    );
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });
    const before = listReads();

    await act(async () => {
      await result.current.create
        .mutateAsync({ assetId: "a1", type: "PRICE", condition: "ABOVE", threshold: 1 })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.create.isError).toBe(true);
    });
    expect(listReads()).toBe(before);
  });
});

describe("useUpdateAlert", () => {
  it("changes that alert, with only the fields it is given", async () => {
    const { call, result } = setup(() => Promise.resolve({ data: alert("al1", false) }));
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });

    await act(async () => {
      await result.current.update.mutateAsync({ alertId: "al1", body: { enabled: false } });
    });

    expect(call).toHaveBeenCalledWith(expect.objectContaining({ operationId: "updateAlert" }), {
      params: { alertId: "al1" },
      body: { enabled: false },
    });
  });

  it("reads the list again once it is changed", async () => {
    const { listReads, result } = setup(() => Promise.resolve({ data: alert("al1", false) }));
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });
    const before = listReads();

    await act(async () => {
      await result.current.update.mutateAsync({ alertId: "al1", body: { threshold: 250 } });
    });

    await waitFor(() => {
      expect(listReads()).toBeGreaterThan(before);
    });
  });
});

describe("useDeleteAlert", () => {
  it("deletes that alert and reads the list again", async () => {
    const { call, listReads, result } = setup(() => Promise.resolve({ data: undefined }));
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });
    const before = listReads();

    await act(async () => {
      await result.current.remove.mutateAsync("al1");
    });

    expect(call).toHaveBeenCalledWith(expect.objectContaining({ operationId: "deleteAlert" }), {
      params: { alertId: "al1" },
    });
    await waitFor(() => {
      expect(listReads()).toBeGreaterThan(before);
    });
  });

  it("keeps the list when the server refuses", async () => {
    const { listReads, result } = setup(() =>
      Promise.reject(new ApiError("NOT_FOUND", "Missing", 404)),
    );
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });
    const before = listReads();

    await act(async () => {
      await result.current.remove.mutateAsync("al9").catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.remove.isError).toBe(true);
    });
    expect(listReads()).toBe(before);
  });
});

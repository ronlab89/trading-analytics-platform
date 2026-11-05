import { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { jobKeys } from "./use-job";
import { useCancelJob, useRetryJob } from "./use-job-actions";

const before = { id: "j1", status: "PROCESSING", stage: "VALIDATING" };
const after = { id: "j1", status: "CANCELLED", stage: "VALIDATING" };

function setup(answer: () => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    () => answer(),
  );
  const queryClient = new QueryClient();
  queryClient.setQueryData(jobKeys.detail("j1"), before);
  const wrapper = tradingClientWrapper({ call }, queryClient);
  return { call, queryClient, wrapper };
}

describe("useCancelJob", () => {
  it("cancels the job by its id", async () => {
    const { call, wrapper } = setup(() => Promise.resolve({ data: after }));
    const { result } = renderHook(() => useCancelJob("j1"), { wrapper });

    await act(() => result.current.mutateAsync());

    expect(call.mock.calls[0]?.[0].operationId).toBe("cancelJob");
    expect(call.mock.calls[0]?.[1]?.params).toEqual({ jobId: "j1" });
  });

  it("puts the answer in the cache of the job, without reading it again", async () => {
    const { call, queryClient, wrapper } = setup(() => Promise.resolve({ data: after }));
    const { result } = renderHook(() => useCancelJob("j1"), { wrapper });

    await act(() => result.current.mutateAsync());

    expect(queryClient.getQueryData(jobKeys.detail("j1"))).toEqual(after);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("leaves the cached job as it was when the API refuses", async () => {
    const { queryClient, wrapper } = setup(() =>
      Promise.reject(new ApiError("CONFLICT", "The job can no longer be cancelled.", 409)),
    );
    const { result } = renderHook(() => useCancelJob("j1"), { wrapper });

    await act(() => result.current.mutateAsync().catch(() => undefined));

    expect(queryClient.getQueryData(jobKeys.detail("j1"))).toEqual(before);
    expect(result.current.error).toBeInstanceOf(ApiError);
  });
});

describe("useRetryJob", () => {
  it("retries the job by its id and puts the queued job in the cache", async () => {
    const queued = { id: "j1", status: "QUEUED", stage: "QUEUED" };
    const { call, queryClient, wrapper } = setup(() => Promise.resolve({ data: queued }));
    const { result } = renderHook(() => useRetryJob("j1"), { wrapper });

    await act(() => result.current.mutateAsync());

    expect(call.mock.calls[0]?.[0].operationId).toBe("retryJob");
    expect(call.mock.calls[0]?.[1]?.params).toEqual({ jobId: "j1" });
    expect(queryClient.getQueryData(jobKeys.detail("j1"))).toEqual(queued);
  });
});

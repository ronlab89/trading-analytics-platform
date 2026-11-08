import { act, renderHook, waitFor } from "@testing-library/react";
import { jobsChannelName, type RealtimeEvent } from "@trading/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CallInput, TradingClient } from "@/api/trading-client";
import { createQueryClient } from "@/lib/query-client";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { JOB_POLL_MS, useJob } from "./use-job";

const job = (status: string, stage = "VALIDATING") => ({
  id: "j1",
  portfolioId: "p1",
  status,
  stage,
  progress: { processed: 0, total: 10 },
});

function event(type: string, jobId = "j1"): RealtimeEvent {
  return {
    id: "e1",
    type,
    channel: jobsChannelName(jobId),
    sequence: 1,
    timestamp: "2026-11-05T14:30:01.000Z",
    epoch: "epoch-1",
    payload: { jobId, status: "PROCESSING" },
  } as unknown as RealtimeEvent;
}

const initial: { jobId: string | undefined } = { jobId: "j1" };

function setup(responses: unknown[], connection: "connected" | "reconnecting" = "connected") {
  let index = 0;
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    () => Promise.resolve({ data: responses[Math.min(index++, responses.length - 1)] }),
  );
  const realtime = createFakeRealtimeClient(connection);
  const view = renderHook(({ jobId }: { jobId: string | undefined }) => useJob(jobId), {
    wrapper: tradingClientWrapper({ call }, createQueryClient(), realtime),
    initialProps: initial,
  });
  return { call, realtime, ...view };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useJob", () => {
  it("reads the job by its id", async () => {
    const { result, call } = setup([job("PROCESSING")]);

    await waitFor(() => {
      expect(result.current.data?.status).toBe("PROCESSING");
    });
    expect(call.mock.calls[0]?.[0].operationId).toBe("getJob");
    expect(call.mock.calls[0]?.[1]?.params).toEqual({ jobId: "j1" });
  });

  it("reads nothing and listens to nothing while there is no job", () => {
    const { call, realtime, rerender } = setup([job("QUEUED")]);
    rerender({ jobId: undefined });

    expect(realtime.subscribedChannels()).toEqual([]);
    expect(call.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("makes no request at all when it starts without a job", () => {
    const call = vi.fn<TradingClient["call"]>();
    renderHook(() => useJob(undefined), {
      wrapper: tradingClientWrapper({ call }),
    });

    expect(call).not.toHaveBeenCalled();
  });

  it("listens to the channel of the job, and leaves it when it unmounts", () => {
    const { realtime, unmount } = setup([job("QUEUED")]);

    expect(realtime.subscribedChannels()).toEqual(["jobs:j1"]);
    unmount();

    expect(realtime.subscribedChannels()).toEqual([]);
  });

  it("reads the job again on each event of its channel, to learn the stage", async () => {
    const { result, call, realtime } = setup([
      job("PROCESSING", "VALIDATING"),
      job("PROCESSING", "APPLYING"),
    ]);
    await waitFor(() => {
      expect(result.current.data?.stage).toBe("VALIDATING");
    });

    act(() => {
      realtime.emit(event("JOB_PROGRESS_UPDATED"));
    });

    await waitFor(() => {
      expect(result.current.data?.stage).toBe("APPLYING");
    });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("does not poll while the socket is connected", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result, call } = setup([job("PROCESSING")], "connected");
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    await act(() => vi.advanceTimersByTimeAsync(JOB_POLL_MS * 3));

    expect(call).toHaveBeenCalledTimes(1);
  });

  it("polls every two seconds while the socket is down and the job has not finished", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result, call } = setup([job("PROCESSING")], "reconnecting");
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    await act(() => vi.advanceTimersByTimeAsync(JOB_POLL_MS + 50));
    expect(call).toHaveBeenCalledTimes(2);

    await act(() => vi.advanceTimersByTimeAsync(JOB_POLL_MS));
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("stops polling once the job has finished", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result, call } = setup([job("COMPLETED")], "reconnecting");
    await waitFor(() => {
      expect(result.current.data?.status).toBe("COMPLETED");
    });

    await act(() => vi.advanceTimersByTimeAsync(JOB_POLL_MS * 3));

    expect(call).toHaveBeenCalledTimes(1);
  });
});

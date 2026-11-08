import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput } from "@/api/trading-client";
import { createQueryClient } from "@/lib/query-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useSessionStore } from "@/stores/session-store";
import type { TrackedJob } from "../lib/job-registry";
import { JOB_POLL_MS } from "./use-job";
import { useTrackedJobs } from "./use-tracked-jobs";
import { useTrackedJobStates } from "./use-tracked-job-states";

const tracked = (id: string): TrackedJob => ({
  id,
  portfolioId: "p1",
  fileName: `${id}.csv`,
  startedAt: "2026-11-07T10:00:00.000Z",
});

const job = (id: string, status: string) => ({
  id,
  portfolioId: "p1",
  status,
  stage: "VALIDATING",
  progress: { processed: 1, total: 4 },
});

type Answer = (jobId: string) => Promise<unknown>;

function setup(userId: string, jobs: TrackedJob[], answer: Answer) {
  sessionStorage.setItem(`trading:jobs:${userId}`, JSON.stringify(jobs));
  useSessionStore.getState().signIn({
    user: { id: userId, email: `${userId}@example.com`, displayName: userId, role: "TRADER" },
    session: { accessToken: "token", expiresAt: "2099-01-01T00:00:00.000Z" },
  });
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (_operation, input) => answer(String(input?.params?.jobId)),
  );
  const view = renderHook(() => ({ states: useTrackedJobStates(), registry: useTrackedJobs() }), {
    wrapper: tradingClientWrapper({ call }, createQueryClient()),
  });
  return { call, ...view };
}

afterEach(() => {
  vi.useRealTimers();
  useSessionStore.getState().signOut();
  sessionStorage.clear();
});

describe("useTrackedJobStates", () => {
  it("reads each tracked job and pairs it with what the device recorded", async () => {
    const { result } = setup("states-pair", [tracked("j1"), tracked("j2")], (id) =>
      Promise.resolve({ data: job(id, "COMPLETED") }),
    );

    await waitFor(() => {
      expect(result.current.states.every(({ job: read }) => read !== undefined)).toBe(true);
    });
    expect(result.current.states.map(({ tracked: held }) => held.fileName)).toEqual([
      "j1.csv",
      "j2.csv",
    ]);
    expect(result.current.states[0]?.job?.status).toBe("COMPLETED");
  });

  it("has no jobs when the device started none", () => {
    const { result, call } = setup("states-none", [], () => Promise.resolve({ data: null }));

    expect(result.current.states).toEqual([]);
    expect(call).not.toHaveBeenCalled();
  });

  it("reads a job that is running again every two seconds, and one that finished once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result, call } = setup("states-poll", [tracked("run"), tracked("done")], (id) =>
      Promise.resolve({ data: job(id, id === "run" ? "PROCESSING" : "COMPLETED") }),
    );
    await waitFor(() => {
      expect(result.current.states.every(({ job: read }) => read !== undefined)).toBe(true);
    });
    const readsOf = (id: string) =>
      call.mock.calls.filter(([, input]) => input?.params?.jobId === id).length;

    await act(() => vi.advanceTimersByTimeAsync(JOB_POLL_MS * 2 + 100));

    expect(readsOf("run")).toBeGreaterThanOrEqual(3);
    expect(readsOf("done")).toBe(1);
  });

  it("forgets a job the API no longer knows", async () => {
    const { result } = setup("states-gone", [tracked("gone"), tracked("kept")], (id) =>
      id === "gone"
        ? Promise.reject(new ApiError("NOT_FOUND", "No such job.", 404))
        : Promise.resolve({ data: job(id, "COMPLETED") }),
    );

    await waitFor(() => {
      expect(result.current.registry.jobs.map(({ id }) => id)).toEqual(["kept"]);
    });
    expect(result.current.states.map(({ tracked: held }) => held.id)).toEqual(["kept"]);
  });

  it("keeps a job whose read failed for another reason", async () => {
    const { result } = setup("states-flaky", [tracked("j1")], () =>
      Promise.reject(new ApiError("INTERNAL_ERROR", "Boom.", 500)),
    );

    await waitFor(() => {
      expect(result.current.states[0]?.isError).toBe(true);
    });
    expect(result.current.registry.jobs).toHaveLength(1);
    expect(result.current.states[0]?.job).toBeUndefined();
  });
});

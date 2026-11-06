import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/stores/session-store";
import type { TrackedJob } from "../lib/job-registry";
import { useTrackedJobs } from "./use-tracked-jobs";

const job = (id: string): TrackedJob => ({
  id,
  portfolioId: "p1",
  fileName: `${id}.csv`,
  startedAt: "2026-11-07T10:00:00.000Z",
});

function signInAs(id: string) {
  useSessionStore.getState().signIn({
    user: { id, email: `${id}@example.com`, displayName: id, role: "TRADER" },
    session: { accessToken: "token", expiresAt: "2099-01-01T00:00:00.000Z" },
  });
}

afterEach(() => {
  useSessionStore.getState().signOut();
  sessionStorage.clear();
});

describe("useTrackedJobs", () => {
  it("starts with no jobs", () => {
    signInAs("tracked-empty");
    const { result } = renderHook(() => useTrackedJobs());

    expect(result.current.jobs).toEqual([]);
  });

  it("shows a job as soon as it is tracked, and keeps it in sessionStorage for the user", () => {
    signInAs("tracked-add");
    const { result } = renderHook(() => useTrackedJobs());

    act(() => {
      result.current.track(job("j1"));
    });

    expect(result.current.jobs.map(({ id }) => id)).toEqual(["j1"]);
    expect(sessionStorage.getItem("trading:jobs:tracked-add")).toContain("j1.csv");
  });

  it("tells every reader when a job is tracked or forgotten", () => {
    signInAs("tracked-readers");
    const first = renderHook(() => useTrackedJobs());
    const second = renderHook(() => useTrackedJobs());

    act(() => {
      first.result.current.track(job("j1"));
    });
    expect(second.result.current.jobs).toHaveLength(1);

    act(() => {
      second.result.current.forget("j1");
    });
    expect(first.result.current.jobs).toEqual([]);
  });

  it("reads what the tab already held", () => {
    sessionStorage.setItem("trading:jobs:tracked-held", JSON.stringify([job("j9")]));
    signInAs("tracked-held");
    const { result } = renderHook(() => useTrackedJobs());

    expect(result.current.jobs.map(({ id }) => id)).toEqual(["j9"]);
  });

  it("keeps nothing without a signed-in user", () => {
    const { result } = renderHook(() => useTrackedJobs());

    act(() => {
      result.current.track(job("j1"));
    });

    expect(result.current.jobs).toEqual([]);
    expect(sessionStorage.length).toBe(0);
  });
});

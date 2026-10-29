import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSessionService, sessionWrapper } from "@/test/session-wrapper";
import { useSessionStore } from "@/stores/session-store";
import { useRestoreSession } from "./use-restore-session";

beforeEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState());
});

describe("useRestoreSession", () => {
  it("restores the session once on mount while the status is unknown", () => {
    const restore = vi.fn<() => Promise<void>>(() => Promise.resolve());

    const { rerender } = renderHook(
      () => {
        useRestoreSession();
      },
      { wrapper: sessionWrapper(fakeSessionService({ restore })) },
    );
    rerender();

    expect(restore).toHaveBeenCalledOnce();
  });

  it.each(["authenticated", "anonymous"] as const)(
    "does not restore when the status is already %s",
    (status) => {
      useSessionStore.setState({ status });
      const restore = vi.fn<() => Promise<void>>(() => Promise.resolve());

      renderHook(
        () => {
          useRestoreSession();
        },
        { wrapper: sessionWrapper(fakeSessionService({ restore })) },
      );

      expect(restore).not.toHaveBeenCalled();
    },
  );
});

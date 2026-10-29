import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/trading-client";
import { fakeSessionService, sessionWrapper } from "@/test/session-wrapper";
import { useLogin } from "./use-login";

describe("useLogin", () => {
  it("signs in through the session service with the given credentials", async () => {
    const login = vi.fn<(email: string, password: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const { result } = renderHook(() => useLogin(), {
      wrapper: sessionWrapper(fakeSessionService({ login })),
    });

    result.current.mutate({ email: "jane@example.com", password: "secret" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(login).toHaveBeenCalledWith("jane@example.com", "secret");
  });

  it("exposes the API error so the form can tell a bad password from a rate limit", async () => {
    const login = () => Promise.reject(new ApiError("RATE_LIMITED", "Too many attempts", 429));
    const { result } = renderHook(() => useLogin(), {
      wrapper: sessionWrapper(fakeSessionService({ login })),
    });

    result.current.mutate({ email: "jane@example.com", password: "wrong" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("reports pending while the request is in flight", async () => {
    let finish: () => void = () => undefined;
    const login = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    const { result } = renderHook(() => useLogin(), {
      wrapper: sessionWrapper(fakeSessionService({ login })),
    });

    result.current.mutate({ email: "jane@example.com", password: "secret" });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });
    finish();
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });
});

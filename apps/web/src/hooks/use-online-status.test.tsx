import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOnlineStatus } from "./use-online-status";

function setOnline(value: boolean) {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(value);
}

describe("useOnlineStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with what the browser reports", () => {
    setOnline(false);

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.online).toBe(false);
  });

  it("follows the browser going offline and back online", () => {
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.online).toBe(false);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.online).toBe(true);
  });

  it("reads the browser again on demand, without waiting for an event", () => {
    setOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.online).toBe(false);

    setOnline(true);
    act(() => {
      result.current.recheck();
    });

    expect(result.current.online).toBe(true);
  });
});

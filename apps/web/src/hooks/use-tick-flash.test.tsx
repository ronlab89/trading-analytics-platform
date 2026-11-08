import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMotionStore } from "@/stores/motion-store";
import { TICK_FLASH_MS, useTickFlash } from "./use-tick-flash";

beforeEach(() => {
  vi.useFakeTimers();
  useMotionStore.setState(useMotionStore.getInitialState());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(initial = { identity: "a1", value: "180.00" }) {
  return renderHook(({ identity, value }) => useTickFlash(identity, value), {
    initialProps: initial,
  });
}

describe("useTickFlash", () => {
  it("does not flash for the first value", () => {
    const { result } = setup();

    expect(result.current).toBe(false);
  });

  it("flashes when the value changes and stops after a second", () => {
    const { result, rerender } = setup();

    rerender({ identity: "a1", value: "181.20" });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(TICK_FLASH_MS - 1);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it("starts the second again when another tick arrives while it flashes", () => {
    const { result, rerender } = setup();
    rerender({ identity: "a1", value: "181.20" });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    rerender({ identity: "a1", value: "181.50" });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe(false);
  });

  it("does not flash when the same value is rendered again", () => {
    const { result, rerender } = setup();

    rerender({ identity: "a1", value: "180.00" });

    expect(result.current).toBe(false);
  });

  it("does not flash when another asset takes the place", () => {
    const { result, rerender } = setup();

    rerender({ identity: "a2", value: "55.00" });

    expect(result.current).toBe(false);
  });

  it("does not flash when the user chose reduced motion", () => {
    useMotionStore.setState({ reducedMotion: true });
    const { result, rerender } = setup();

    rerender({ identity: "a1", value: "181.20" });

    expect(result.current).toBe(false);
  });

  it("does not flash when the system asks for reduced motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { result, rerender } = setup();

    rerender({ identity: "a1", value: "181.20" });

    expect(result.current).toBe(false);
  });

  it("clears its timer when it unmounts", () => {
    const { rerender, unmount } = setup();
    rerender({ identity: "a1", value: "181.20" });

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

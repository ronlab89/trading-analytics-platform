import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMotionStore } from "@/stores/motion-store";
import { useReducedMotion } from "./use-reduced-motion";

const originalMatchMedia = Reflect.get(window, "matchMedia");

function systemAsks(reduce: boolean) {
  Reflect.set(window, "matchMedia", (query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
  useMotionStore.setState({ reducedMotion: false });
});

afterEach(() => {
  Reflect.set(window, "matchMedia", originalMatchMedia);
});

describe("useReducedMotion", () => {
  it("is off when neither the user nor the system asks for it", () => {
    systemAsks(false);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });

  it("is on when the system asks for it", () => {
    systemAsks(true);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
  });

  it("is on when the user chose it, and follows the choice when it changes", () => {
    systemAsks(false);
    const { result } = renderHook(() => useReducedMotion());

    act(() => {
      useMotionStore.getState().setReducedMotion(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      useMotionStore.getState().setReducedMotion(false);
    });
    expect(result.current).toBe(false);
  });
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile, useMediaQuery } from "./use-media-query";

type Listener = () => void;

/** A `matchMedia` whose answer the test can change, notifying whoever listens. */
function stubMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  const matchMedia = vi.fn((query: string) => ({
    media: query,
    get matches() {
      return matches;
    },
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  }));
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    listeners,
    set: (next: boolean) => {
      matches = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("answers whether the query matches right now", () => {
    const media = stubMatchMedia(true);

    const { result } = renderHook(() => useMediaQuery("(max-width: 560px)"));

    expect(result.current).toBe(true);
    expect(media.matchMedia).toHaveBeenCalledWith("(max-width: 560px)");
  });

  it("follows the query as the screen changes", () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(max-width: 560px)"));
    expect(result.current).toBe(false);

    act(() => {
      media.set(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      media.set(false);
    });
    expect(result.current).toBe(false);
  });

  it("stops listening once the component is gone", () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery("(max-width: 560px)"));
    expect(media.listeners.size).toBe(1);

    unmount();

    expect(media.listeners.size).toBe(0);
  });

  it("answers no where the browser cannot match media, as the test environment cannot", () => {
    vi.stubGlobal("matchMedia", undefined);

    const { result } = renderHook(() => useMediaQuery("(max-width: 560px)"));

    expect(result.current).toBe(false);
  });
});

describe("useIsMobile", () => {
  it("is the mobile layout of ADR-010: up to 560 px wide", () => {
    const media = stubMatchMedia(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
    expect(media.matchMedia).toHaveBeenCalledWith("(max-width: 560px)");
  });
});

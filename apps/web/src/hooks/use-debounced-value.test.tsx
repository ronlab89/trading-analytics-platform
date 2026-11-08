import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./use-debounced-value";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function render(initial: string) {
  return renderHook(({ value }) => useDebouncedValue(value, 250), {
    initialProps: { value: initial },
  });
}

describe("useDebouncedValue", () => {
  it("starts with the value it is given", () => {
    expect(render("a").result.current).toBe("a");
  });

  it("keeps the old value until the new one has been still for the delay", () => {
    const { result, rerender } = render("a");

    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("ab");
  });

  it("starts the wait again on every change, so only the last value comes through", () => {
    const { result, rerender } = render("a");

    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: "abc" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe("abc");
  });
});

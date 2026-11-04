import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReplayPlayer } from "./use-replay-player";

const render = (eventCount = 4) =>
  renderHook(({ count }) => useReplayPlayer(count), { initialProps: { count: eventCount } });

const advance = (milliseconds: number) => {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
};

describe("useReplayPlayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts on the last event, so the page opens on the decision as it stands", () => {
    const { result } = render();

    expect(result.current.index).toBe(3);
    expect(result.current.status).toBe("finished");
    expect(result.current.speed).toBe(1);
    advance(10_000);
    expect(result.current.index).toBe(3);
  });

  it("plays from the first event again when it has finished, and stops on the last", () => {
    const { result } = render();

    act(() => {
      result.current.toggle();
    });
    expect(result.current.index).toBe(0);
    expect(result.current.status).toBe("playing");

    advance(1500);
    expect(result.current.index).toBe(1);
    advance(1500);
    expect(result.current.index).toBe(2);
    advance(1500);
    expect(result.current.index).toBe(3);
    expect(result.current.status).toBe("finished");

    advance(10_000);
    expect(result.current.index).toBe(3);
  });

  it("stays where it is when paused and goes on from there", () => {
    const { result } = render();
    act(() => {
      result.current.toggle();
    });
    advance(1500);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.status).toBe("paused");
    advance(10_000);
    expect(result.current.index).toBe(1);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.status).toBe("playing");
    advance(1500);
    expect(result.current.index).toBe(2);
  });

  it("takes half the time at 2× and twice the time at 0.5×", () => {
    const { result } = render();
    act(() => {
      result.current.toggle();
      result.current.setSpeed(2);
    });

    advance(749);
    expect(result.current.index).toBe(0);
    advance(1);
    expect(result.current.index).toBe(1);

    act(() => {
      result.current.setSpeed(0.5);
    });
    advance(2999);
    expect(result.current.index).toBe(1);
    advance(1);
    expect(result.current.index).toBe(2);
  });

  it("moves one event and pauses with previous and next", () => {
    const { result } = render();
    act(() => {
      result.current.toggle();
    });
    advance(1500);

    act(() => {
      result.current.next();
    });
    expect(result.current.index).toBe(2);
    expect(result.current.status).toBe("paused");
    advance(10_000);
    expect(result.current.index).toBe(2);

    act(() => {
      result.current.previous();
    });
    expect(result.current.index).toBe(1);
    expect(result.current.status).toBe("paused");
  });

  it("goes no further than the first and the last event", () => {
    const { result } = render(2);

    expect(result.current.canGoNext).toBe(false);
    expect(result.current.canGoPrevious).toBe(true);
    act(() => {
      result.current.next();
    });
    expect(result.current.index).toBe(1);

    act(() => {
      result.current.previous();
    });
    expect(result.current.index).toBe(0);
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(true);
    act(() => {
      result.current.previous();
    });
    expect(result.current.index).toBe(0);
  });

  it("has nothing to play with a single event", () => {
    const { result } = render(1);

    act(() => {
      result.current.toggle();
    });
    advance(10_000);

    expect(result.current.index).toBe(0);
    expect(result.current.status).toBe("finished");
  });

  it("has no event to point at when there are none", () => {
    const { result } = render(0);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.index).toBe(-1);
    expect(result.current.status).toBe("finished");
  });

  it("never points past the events when there are fewer of them", () => {
    const { result, rerender } = render(4);

    rerender({ count: 2 });

    expect(result.current.index).toBe(1);
    expect(result.current.status).toBe("finished");
  });

  it("stops its timer when it leaves the page", () => {
    const { result, unmount } = render();
    act(() => {
      result.current.toggle();
    });

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

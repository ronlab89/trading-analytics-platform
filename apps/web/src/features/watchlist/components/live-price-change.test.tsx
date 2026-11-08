import { act, render as baseRender, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { TICK_FLASH_MS } from "@/hooks/use-tick-flash";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { useMotionStore } from "@/stores/motion-store";
import { createFakeRealtimeClient, type FakeRealtimeClient } from "@/test/fake-realtime-client";
import { LivePriceChange } from "./live-price-change";
import { PriceChangeBadge } from "./price-change-badge";

const usd = (amount: string) => ({ amount, currency: "USD" });

function render(
  ui: ReactElement,
  realtime: FakeRealtimeClient = createFakeRealtimeClient("connected"),
) {
  const view = baseRender(<RealtimeClientProvider client={realtime}>{ui}</RealtimeClientProvider>);
  return {
    ...view,
    // A rerender keeps the same provider, as the app does between two ticks.
    rerender: (next: ReactElement) => {
      view.rerender(<RealtimeClientProvider client={realtime}>{next}</RealtimeClientProvider>);
    },
    realtime,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  useMotionStore.setState(useMotionStore.getInitialState());
});
afterEach(() => {
  vi.useRealTimers();
});

const isSolid = (element: HTMLElement) => element.className.includes("-solid-");
const isSubtle = (element: HTMLElement) => element.className.includes("-subtle-");

describe("PriceChangeBadge solid", () => {
  it("is subtle by default and solid on request, with the same text and arrow", () => {
    const { rerender } = render(<PriceChangeBadge percent={2.6} />);
    const badge = screen.getByText("+2.60%");
    expect(isSubtle(badge)).toBe(true);

    rerender(<PriceChangeBadge percent={2.6} solid />);

    expect(isSolid(screen.getByText("+2.60%"))).toBe(true);
    expect(screen.getByText("+2.60%").querySelector("svg")).not.toBeNull();
  });
});

describe("LivePriceChange", () => {
  it("is subtle at first, goes solid for a second when the price ticks, then subtle again", () => {
    const { rerender } = render(
      <LivePriceChange assetId="a1" percent={2.1} price={usd("180.70")} />,
    );
    expect(isSubtle(screen.getByText("+2.10%"))).toBe(true);

    rerender(<LivePriceChange assetId="a1" percent={2.6} price={usd("181.20")} />);
    expect(isSolid(screen.getByText("+2.60%"))).toBe(true);

    act(() => {
      vi.advanceTimersByTime(TICK_FLASH_MS);
    });
    expect(isSubtle(screen.getByText("+2.60%"))).toBe(true);
  });

  it("flashes when only the price moves and the change stays", () => {
    const { rerender } = render(
      <LivePriceChange assetId="a1" percent={2.1} price={usd("180.70")} />,
    );

    rerender(<LivePriceChange assetId="a1" percent={2.1} price={usd("180.71")} />);

    expect(isSolid(screen.getByText("+2.10%"))).toBe(true);
  });

  it("does not flash when the user chose reduced motion", () => {
    useMotionStore.setState({ reducedMotion: true });
    const { rerender } = render(
      <LivePriceChange assetId="a1" percent={2.1} price={usd("180.70")} />,
    );

    rerender(<LivePriceChange assetId="a1" percent={2.6} price={usd("181.20")} />);

    expect(isSubtle(screen.getByText("+2.60%"))).toBe(true);
  });

  it("keeps the sign in the text while it flashes, so the color is never alone", () => {
    const { rerender } = render(
      <LivePriceChange assetId="a1" percent={-1} price={usd("180.70")} />,
    );

    rerender(<LivePriceChange assetId="a1" percent={-1.4} price={usd("178.00")} />);

    const badge = screen.getByText("-1.40%");
    expect(isSolid(badge)).toBe(true);
    expect(badge.querySelector("svg")).not.toBeNull();
  });

  it("shows a dash for an unknown change", () => {
    render(<LivePriceChange assetId="a1" percent={null} price={null} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("LivePriceChange while the connection is lost", () => {
  it.each(["reconnecting", "failed"] as const)(
    "says the price is paused, with a clock, while the state is %s",
    (state) => {
      render(
        <LivePriceChange assetId="a1" percent={2.1} price={usd("180.70")} />,
        createFakeRealtimeClient(state),
      );

      const badge = screen.getByText("Paused");
      expect(badge.querySelector("svg")).not.toBeNull();
      expect(screen.queryByText("+2.10%")).not.toBeInTheDocument();
    },
  );

  it.each(["connected", "connecting", "disconnected"] as const)(
    "keeps the change while the state is %s",
    (state) => {
      render(
        <LivePriceChange assetId="a1" percent={2.1} price={usd("180.70")} />,
        createFakeRealtimeClient(state),
      );

      expect(screen.getByText("+2.10%")).toBeInTheDocument();
      expect(screen.queryByText("Paused")).not.toBeInTheDocument();
    },
  );

  it("goes back to the change when the connection returns", () => {
    const { realtime } = render(
      <LivePriceChange assetId="a1" percent={2.1} price={usd("180.70")} />,
      createFakeRealtimeClient("reconnecting"),
    );
    expect(screen.getByText("Paused")).toBeInTheDocument();

    act(() => {
      realtime.setState("connected");
    });

    expect(screen.getByText("+2.10%")).toBeInTheDocument();
  });
});
